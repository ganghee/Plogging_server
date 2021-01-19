const express = require('express');
const cors=require('cors');
const util = require('../util/common.js');
const USER_TABLE = 'user';
const fs = require('fs');
const { uptime } = require('process');
const crypto = require('crypto');
const { assert } = require('console');
const filePath = process.env.IMG_FILE_PATH;
const swaggerValidation = require('../util/validator')

const UserInterface = function(config) {
    const router = express.Router();
    
    router.all('*'  ,cors());
    this.router = router;
    this.mysqlPool = config.mysqlPool;
    this.pool = config.mysqlPool2;
    this.redisClient = config.redisClient;
    this.fileInterface = config.fileInterface;
    this.MongoPool = config.MongoPool;

    const upload = this.fileInterface({
        storage: this.fileInterface.diskStorage({
            destination: function (req, file, cb) {
            const userId = req.userId; // 세션체크 완료하면 값 받아옴
	        const dir = `${filePath}${userId}`;
    
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
            }
            cb(null, dir);
            },
            filename: function (req, file, cb) {
            cb(null, `profileImg.PNG`);
            }
        }),
        limits: {fileSize: 1*1000*5000}, // file upload 5MB 제한
        })

    // 유저 관련 api 구현
    router.post('', (req, res) => this.signIn(req, res));
    router.get('', (req, res) => this.getUserInfo(req, res));
    router.get('/sign-out', (req, res) => this.signOut(req, res));
    router.put('', upload.single('profile_img'), (req, res) => this.update(req, res));
    router.delete('', (req, res) => this.withdrawal(req, res));
    return this.router;
};

UserInterface.prototype.signIn = async function(req, res) {

    let returnResult = { rc: 500, rcmsg: "server error" };
    const secretKey = req.body.secretKey;
    const [userEmail, userType] = req.body.userId.split(":");
    const userName = req.body.userName;

    // case no parameter
    if(!userEmail || !userType) {
        returnResult.rc = 400;
        returnResult.rcmsg = "no parameter";
        res.status(400).send(returnResult);
        return;
    }
    if(userType.toLowerCase() === 'custom' && !secretKey){
        returnResult.rc = 400;
        returnResult.rcmsg = "no parameter";
        res.status(400).send(returnResult);
        return;
    }
    
    // search userId in DB
    const userId = req.body.userId
    const findUserQuery = `SELECT * FROM ${USER_TABLE} WHERE user_id = ?`;
    const findUserValues = [userId];

    this.pool.getConnection(function(err, conn){
        conn.beginTransaction();
        conn.execute(findUserQuery, findUserValues, function(err, result) {
            
            if (result.length === 0) {
                
                // set userImg
                let userImg = "https://i.pinimg.com/564x/d0/be/47/d0be4741e1679a119cb5f92e2bcdc27d.jpg";
                const createDateline = util.getCurrentDateTime();
                let createUserQuery
                let createUserValues
                if(userType.toLowerCase() === 'custom'){
                    const salt = (crypto.randomBytes(32)).toString('hex');
                    const hashedPassword = crypto.pbkdf2Sync(secretKey, salt, 10000, 64, 'sha512').toString('base64');
                    createUserQuery = `INSERT INTO ${USER_TABLE}(user_id, display_name, profile_img, type, email, update_datetime, create_datetime, salt, hash_password) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    createUserValues = [userId, userName, userImg, userType, userEmail, createDateline, createDateline, salt, hashedPassword];
                }else{
                    createUserQuery = `INSERT INTO ${USER_TABLE}(user_id, display_name, profile_img, type, email, update_datetime, create_datetime) VALUES(?, ?, ?, ?, ?, ?, ?)`;
                    createUserValues = [userId, userName, userImg, userType, userEmail, createDateline, createDateline];
                }
                
                conn.execute(createUserQuery, createUserValues, function(err, result){
                    if(err) {
                        returnResult.rc = 600;
                        returnResult.rcmsg = err.message;
                        res.send(returnResult);
                        conn.rollback();
                    }else{
                        req.session.userId = userId;
                        returnResult.rc = 200;
                        returnResult.rcmsg = "Success creating user";
                        returnResult.session = req.session.id;
                        returnResult.userImg = userImg;
                        returnResult.userName = userName;
                        res.send(returnResult);
                        conn.commit();
                    }
                });
                if(err) {
                    returnResult.rc = 600;
                    returnResult.rcmsg = err.message;
                    res.send(returnResult);
                    conn.rollback();
                }
            }else{
                if(userType.toLowerCase() === 'custom'){
                    const hashedPassword = crypto.pbkdf2Sync(secretKey, result[0].salt, 10000, 64, 'sha512').toString('base64');
                    if(hashedPassword != result[0].hash_password){
                        returnResult.rc = 401;
                        returnResult.rcmsg = "password error";
                        res.send(returnResult);
                        conn.rollback();
                        return;
                    }
                }
                req.session.userId = userId
                returnResult.rc = 200;
                returnResult.rcmsg = "Success getting user";
                returnResult.session = req.session.id;
                returnResult.userImg = result[0].profile_img;
                returnResult.userName = result[0].display_name;
                res.send(returnResult);
                conn.commit();
            };
        });
        if(err){
            returnResult.rc = 600;
            returnResult.rcmsg = err.message;
            res.send(returnResult);
            conn.rollback();
        }
        conn.release();
    });
}


UserInterface.prototype.getUserInfo = async function(req, res) {
    
    const pool = this.pool;
    let returnResult = { rc: 200, rcmsg: 'success' };
    console.log(req.session.userId);
    if(!req.session){
        returnResult.rc = 401;
        returnResult.rcmsg = "no header key"
        return;
    }
    try {
        const getUserQuery = `SELECT * FROM ${USER_TABLE} WHERE user_id = ?`;
        const getUserValues = [req.session.userId];
        
        pool.execute(getUserQuery, getUserValues, function(err, result) {
            console.log(result);
            if(result.length){
                returnResult.rc = 200;
                returnResult.rcmsg = 'success';
                returnResult.userId = result[0].user_id;
                returnResult.userImg = result[0].profile_img;
                returnResult.userName = result[0].display_name;
                res.send(returnResult);
            }else{
                returnResult.rc = 500;
                returnResult.rcmsg = 'Getting user error';
                res.send(returnResult);
            }
            if(err){
                returnResult.rc = 600;
                returnResult.rcmsg = err.message;
                res.send(returnResult);
            }
        })
    } catch (error) {
        returnResult.rc = 500;
        returnResult.rcmsg = error.message;
        res.send(returnResult);
    }
}

UserInterface.prototype.update = async function(req, res) {
    
    const pool = this.pool;
    let returnResult = { rc: 200, rcmsg: "success" };
    const user = req.body;
    const userId = req.userId;
    const currentTime = util.getCurrentDateTime();
    if(!req.session){
        returnResult.rc = 401;
        returnResult.rcmsg = "no header key"
        return;
    }
    try {
        if(!user.display_name || !req.file) {
            returnResult.rc = 400;
            returnResult.rcmsg = "no parameter";
            res.status(400).send(returnResult);
            return;
        }else{
            const profileImg = process.env.SERVER_REQ_INFO + '/' + req.file.path.split("/mnt/Plogging_server/images/")[1];
            const updateUserQuery = `UPDATE ${USER_TABLE} SET display_name = ?, profile_img = ?, update_datetime = ? WHERE user_id = ?`
            const updateUserValues = [user.display_name, profileImg, currentTime, req.session.userId];
            
            pool.execute(updateUserQuery, updateUserValues, function(err, result) {
                if(result.affectedRows){
                    returnResult.rc = 200;
                    returnResult.rcmsg = "Success user updated";
                    returnResult.displayName = user.display_name;
                    returnResult.profile_img = profileImg;
                    res.send(returnResult);
                }else{
                    returnResult.rc = 500;
                    returnResult.rcmsg = "user update error";
                    res.send(returnResult);
                }
                if(err){
                    returnResult.rc = 600;
                    returnResult.rcmsg = err.message;
                    res.send(returnResult);
                }
            })
        }
    } catch (error) {
        returnResult.rc = 500;
        returnResult.rcmsg = error.message;
        res.send(returnResult);
    }
}

UserInterface.prototype.signOut = async function(req, res) {
    let returnResult = { rc: 200, rcmsg: "success sign out" };
    if(!req.session){
        returnResult.rc = 401;
        returnResult.rcmsg = "no header key"
        return;
    }
    req.session.destroy(function(err) {
        if(err) {
            returnResult.rc = 500;
            returnResult.rcmsg = "server err"
            res.send(returnResult);
        }else {
            res.send(returnResult);
        }
    })
}

UserInterface.prototype.withdrawal = async function(req, res) {
    let returnResult = { rc: 200, rcmsg: "success withdrawal" };
    const userId = req.session.userId;
    if(!req.session){
        returnResult.rc = 401;
        returnResult.rcmsg = "no header key"
        return;
    }
    const deleteUserQuery = `DELETE FROM ${USER_TABLE} WHERE user_id = ?`;
    const deleteUserValues = [userId];
    const mongoConnection = this.MongoPool.db('plogging');
    this.pool.getConnection(function(err, conn){
        conn.beginTransaction();
        conn.execute(deleteUserQuery, deleteUserValues, function(err, result) {
            if(result.affectedRows){
                // 탈퇴 유저의 이력 전체 삭제
                mongoConnection.collection('record')
                    .deleteMany({"meta.user_id": userId}, function(err, result) {
                        if(err){
                            returnResult.rc = 500;
                            returnResult.rcmsg = 'delete user error';
                            res.send(returnResult);
                            conn.rollback();
                        }else{
                            try {
                                // 탈퇴 유저의 산책이력 이미지 전체 삭제
                                if(fs.existsSync(`${filePath}${userId}`)){
                                    fs.rmdirSync(`${filePath}${userId}`, { recursive: true });
                                }
                                // 해당 산책의 점수 랭킹점수 삭제
                                //await this.redisAsyncZrem(queryKey, userId);
                                returnResult.rc = 200;
                                returnResult.rcmsg = 'success withdrawal';
                                res.send(returnResult);
                                req.session.destroy();
                                conn.commit();
                            } catch (error) {
                                returnResult.rc = 510;
                                returnResult.rcmsg = error.message;
                                res.send(returnResult);
                                conn.rollback();
                            }
                        }
                });
                
            }else{
                returnResult.rc = 500;
                returnResult.rcmsg = 'delete user error';
                res.send(returnResult);
            };
            if(err){
                returnResult.rc = 600;
                returnResult.rcmsg = err.message;
                res.send(returnResult);
            };
            
        });
        if(err){
            returnResult.rc = 500;
            returnResult.rcmsg = err.message;
            res.send(returnResult);
        };
        conn.release();
    });
}

module.exports = UserInterface;
