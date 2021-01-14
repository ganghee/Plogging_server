const express = require('express');
const app = express();
const { promisify } = require('util');

const UserInterface = require("./router/user.js");
const PloggingInferface = require('./router/plogging.js');
const RankingInterface = require('./router/ranking.js');
const bodyParser = require('body-parser');
const poolCallback = require("./config/mysqlConfig.js").getMysqlPool; // callback
const poolAsyncAwait = require("./config/mysqlConfig.js").getMysqlPool2; // async await
const redisClient = require("./config/redisConfig.js");
const MongoClient = require("./config/mongoConfig.js");

const session = require('express-session');
const redisStore = require('connect-redis')(session);
const multer  = require('multer')

// node-swagger
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
    info: { // API informations (required)
      title: 'Plogging ', // Title (required)
      version: '1.0.0', // Version (required)
      description: 'Plogging API docs', // Description (optional)
    },
    host: '121.130.220.217:20000', // Host (optional)
    basePath: '/', // Base path (optional)
}
const swaggerOptions = {
    // Import swaggerDefinitions
    swaggerDefinition: swaggerDefinition,
    // Path to the API docs
    apis: ['./router/user.js', './router/plogging.js', './router/ranking.js']
  }

  const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(express.static('/mnt/Plogging_server/images')); // 정적파일 제공

// redis sessionStorage 설정
app.use(session({
    store : new redisStore({ // default는 메모리에 저장
        client: redisClient,
        ttl: 60*30 // expires ( per in second ) - 30분
    }),
    secret: "plogging", // sessionId를 만들때 key로 쓰이는거 같음
    resave: false,
    saveUninitialized: true,
}));

// 전역 설정
const globalOption = {};
globalOption.PORT = process.env.PORT;
globalOption.mysqlPool=poolCallback;
globalOption.mysqlPool2=poolAsyncAwait;
globalOption.redisClient=redisClient;
globalOption.fileInterface = multer;

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // node-swaggwer

/**
* step 1. userId가 파라미터로 들어왔는지 확인 ( req.query.userId )
* step 2. 
*    2-1. 파라미터로 안들어왔다면 redis에서 조회한 값으로 userId 세팅 ( 산책이력 조회, 산책이력 등록, 산책이력 삭제 )
*    2-2. 파라미터로 들어왔다면 파리미터로 들어온 값으로 userId 세팅 ( 산책이력 조회 ) 
* 
*/
app.use("/", function(req, res, next) {

    // 세션 체크 공통 모듈
    if(req.path === '/user' && req.method === 'POST') next();
    else {
        const sessionKey = req.get('sessionKey');

        if(sessionKey === req.session.id) {  // 세션 값이 있는 경우 ( 로그인이 되어있는 경우 )
            req.userId = req.session.userId;
            next();
        } else { // 세션 값이 없는 경우 ( 로그인이 안되어 있는 경우 )
            let returnResult = { rc: 401, rcmsg: "unauthorized" };
            res.status(401).send(returnResult);
        }
    }
});


app.use('/user', new UserInterface(globalOption)); // 유저 관려 api는 user.js로 포워딩
app.use('/rank', new RankingInterface(globalOption)); // 랭킹 관련 api는 ranking.js로 포워딩

async function main( ) {
    try {
        const mongoConnectioPool = await MongoClient.connect();
        globalOption.MongoPool=mongoConnectioPool;
        app.use('/plogging', new PloggingInferface(globalOption)); // 쓰레기 관련 api는 plogging.js로 포워딩        
    } catch(e) {
        console.log(e);
    } 
}

main().catch(console.error);

app.listen(globalOption.PORT, function(req, res) {
    console.log(`server on ${globalOption.PORT} !`);
})
