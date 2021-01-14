module.exports = {
    apps : [
        {
          name: "plogging server",
          script: "./index.js",
          watch: true,
          out_file: "/dev/null",
          error_file: "/dev/null",
          env: { // 로컬
              "NODE_ENV": "local",
              "PORT": 20000,
              "LOG_PATH": "",
              "LOG_LEVEL": "debug",
              "MONGODB_INFO": "127.0.0.1:27017",
              "MONGODB_PASSWORD": "JjaoSaoP+IRVDBkXdDR4XMgTmkMut0VM",
              "REDIS_INFO": "127.0.0.1:1234",
              "REDIS_PASSWORD":"JjaoSaoP+IRVDBkXdDR4XMgTmkMut0VM",
              "MARIADB_INFO": "127.0.0.1:3306",
              "MARIADB_PASSWORD": "JjaoSaoP+IRVDBkXdDR4XMgTmkMut0VM",
              "IMG_FILE_PATH": "E:file_test/",
              "SERVER_REQ_INFO": "http://localhost:20000/plogging/"
          },
          env_development: { // tb ( 라즈베리파이 서버 )
            "NODE_ENV": "development",
            "PORT": 80,
            "LOG_PATH": "",
            "LOG_LEVEL": "debug",
            "MONGODB_INFO": "172.17.0.1:27017",
            "MONGODB_PASSWORD": "JjaoSaoP+IRVDBkXdDR4XMgTmkMut0VM",
            "REDIS_INFO": "172.17.0.1:6379",
            "REDIS_PASSWORD":"JjaoSaoP+IRVDBkXdDR4XMgTmkMut0VM",
            "MARIADB_INFO": "172.17.0.1:3306",
            "MARIADB_PASSWORD": "JjaoSaoP+IRVDBkXdDR4XMgTmkMut0VM",
            "IMG_FILE_PATH": "/home/ubuntu/exhard/ploggingImgs",
            "SERVER_REQ_INFO": "http://121.131.220.217:20000/plogging/"

          },
          env_production: { // 상용 ( 클라우드 서버 )
            "NODE_ENV": "production",
          }
        }
    ]
  }