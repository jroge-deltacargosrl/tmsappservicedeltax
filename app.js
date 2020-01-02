const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mssql = require('mssql');
const cors = require('cors');


const utils = require('./utils');
const moment = require('moment');

var dbConfigAzure = {
    server: 'deltacargosql.database.windows.net',
    database: 'DeltaX',
    user: 'deltasa',
    password: 'Delta123#',
    port: 1433,
    encrypt: true
};

//#region Configuration App uses

app.use(cors());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.options('*', cors());
app
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({
        extended: false
    }));
//#endregion

app.get('/test', (req, res) => {
    res.json({
        id: 1,
        message: 'Para evaluar sus conocimientos, y no desperdiciar gente del equipo que es necesaria para el proyecto. Y no mandarlo abajo solo por que entro de ultimo'
    });
});

app.post('/test', (req, res) => {
    let responseJroge = {
        id: req.body.id,
        message: req.body.message
    };
    res.json('ok');
    console.log(responseJroge);
})


//#region API : User
app.post('/logout', (req, res) => {
    let user = {
        userId: req.body.userId,
        token: req.body.token
    };
    //console.log(user);
    //logOut(res, user);
    logOutUser(res, user);
});

app.post('/login', (req, res) => {
    //res.json(req.body);
    let user = {
        email: req.body.email,
        password: req.body.password
    };
    console.log(user);
    mssql.connect(dbConfigAzure, (err) => {
        //var querySql = `Select * from DCS.Users where UserName = '${login.email}' and UserPassword = '${login.password}'`;
        new mssql
            .Request()
            .input('email', mssql.VarChar, user.email)
            .input('password', mssql.VarChar, user.password)
            .query('select top(1) t1.UserId, t1.UserName, t1.UserFullName, t2.TokenKey, t2.TokenActive from DCS.Users t1 left join DCS.Token t2 on t2.UserId = t1.UserId where UserName = @email and UserPassword = @password order by t2.TokenId desc')
            .then(dbData => {
                if (dbData == null || dbData.length == 0) {
                    res.status(200).json({
                        status: -1,
                        message: 'Error database Connection',
                    });
                } else if (dbData.rowsAffected[0] == 0) {
                    //console.log(dbData);
                    res.status(200).json({
                        status: 0,
                        message: 'login failed, bad credentials',
                    });
                } else {
                    let userCreated = dbData.recordset[0];
                    //console.log(userDb);
                    if (userCreated.TokenActive == 0 || userCreated.TokenKey == null) {
                        let token = utils.randomToken(64);
                        // actualizacion manual
                        userCreated.TokenKey = token;
                        userCreated.TokenActive = 1;
                        saveTokenUserLogin(token, userCreated.UserId);
                        res.status(200).json({
                            status: 1,
                            message: 'login successfully',
                            user: userCreated
                                //token: token
                        });
                    } else { // sesion del usuario abierta en otro dispositivo
                        res.status(200).json({
                            status: 2,
                            message: 'login refused, open session in other device',
                        });
                    }
                }

            }).catch(err => console.log(err));
    });
    //res.json('exitoso');
    //console.log(user);
});

app.post('/user', async(req, res) => {
    let user = {
        fullname: req.body.fullname,
        email: req.body.email,
        password: req.body.password // encriptar la contraseña en la base de datos
    };
    await createUser(res, user);
})

app.get('/user', (req, res) => {
    getUsers(res);
});
//#endregion

//#region API: OpportunityBid

app.post('/opportunity/applyOffer', (req, res) => {
    let opportunityBid = {
        opportunityId: req.body.opportunityId,
        userId: req.body.userId
    };
    applyOfferOpportuntiy(res, opportunityBid);
});

let applyOfferOpportuntiy = (res, opportunityBid) => {
    var pool = new mssql.ConnectionPool(dbConfigAzure, (err) => {
        var transact = new mssql.Transaction(pool);
        transact.begin((err) => {
            var rollback = false;
            transact.on('rollaback', (aborted) => {
                rollback = true;
            });
            let state = 10; // Bid Accepted
            new mssql
                .Request(transact)
                .input('opportunityId', mssql.Int, opportunityBid.opportunityId)
                .input('userId', mssql.Int, opportunityBid.userId)
                .input('opportunityBidStatus', mssql.Int, state)
                .input('dateTimeBidAccepted', mssql.DateTime, new Date())
                .query('insert into [DCS].[OpportunityBid]([OpportunityId], [UserId], [OpportunityBidStatusId], [DateTimeBidAccepted]) values (@opportunityId, @userId, @opportunityBidStatus, @dateTimeBidAccepted)', (err, recordSet) => {
                    if (err) {
                        if (!rollback) {
                            transact.rollback(err => console.log(err))
                        }
                    } else {
                        transact
                            .commit()
                            .then((recordSet) => {
                                res.json({
                                    status: 1,
                                    message: "successful application for the opportunity"
                                });
                            }).catch((err) => res.json({
                                status: -1,
                                message: "Error database connection"
                            }));
                    }
                });

        })
    });
}

app.put('/opportunity/cancellOffer', (req, res) => {
    let opportunityBid = {
        opportunityId: req.body.opportunityId,
        userId: req.body.userId
    };
    cancellOfferOpportunity(res, opportunityBid);
});

let cancellOfferOpportunity = (res, opportunityBid) => {
    var pool = new mssql.ConnectionPool(dbConfigAzure, (err) => {
        var transact = new mssql.Transaction(pool);
        transact.begin((err) => {
            var rollback = false;
            transact.on('rollback', (aborted) => {
                rollback = true;
            });
            let state = 98; // Bid withdraw
            console.log(opportunityBid);
            new mssql
                .Request(transact)
                .input('opportunityId', mssql.Int, opportunityBid.opportunityId)
                .input('userId', mssql.Int, opportunityBid.userId)
                .input('opportunityBidStatus', mssql.Int, state)
                .input('dateTimeBidAccepted', mssql.DateTime, new Date())
                .query('UPDATE [DCS].[OpportunityBid] set [OpportunityBidStatusId] = @opportunityBidStatus, [DateTimeBidWithdraw] = @dateTimeBidAccepted  where [OpportunityId] = @opportunityId and [UserId] = @userId and [OpportunityBidStatusId] = 10', (err, recordSet) => {
                    if (err) {
                        if (!rollback) {
                            transact.rollback(err => console.log(err))
                        }
                    } else {
                        transact
                            .commit()
                            .then((recordSet) => {
                                res.json({
                                    status: 1,
                                    message: "offer rejected successfully"
                                });
                            }).catch((err) => res.json({
                                status: -1,
                                message: "Error database connection"
                            }));
                    }
                });

        })
    });
}


//#endregion


//#region API: Opportunity
app.get('/opportunity/:opportunityId', (req, res) => {
    let opportunityId = req.params.opportunityId;
    getOpportunitiesById(res, opportunityId);
});

app.get('/opportunity/availablesToApply/:userId', (req, res) => {
    let userId = req.params.userId;
    getOpportunitiesOffered(res, userId);
});
//#endregion

//#region Methods: Opportunity

// arreglar la respuesta de tipo Array -> Tipo object
let getOpportunitiesById = (res, opportunityId) => {
        mssql.connect(dbConfigAzure, (err) => {
            new mssql
                .Request()
                .input('opportunityId', mssql.Int, opportunityId)
                .query('Select * from DCS.Opportunity where OpportunityId = @opportunityId') // Accept Aplicactions = 20
                .then(dbData => {
                    if (dbData == null || dbData.length == 0) {
                        res.status(200).json({
                            status: -1,
                            message: 'Error database Connection'
                        });
                    } else {
                        res.status(200).json({
                            status: 1,
                            opportunity: dbData.recordset
                        });
                    }
                    //console.log(dbData);
                }).catch(err => console.log(err));
        });
    }
    //#endregion



//#region Methods: User



let getUsers = (res) => {
    mssql.connect(dbConfigAzure, (err) => {
        new mssql
            .Request()
            .query('Select * from DCS.Users')
            .then(dbData => {
                if (dbData == null || dbData.length == 0) {
                    res.status(200).json({
                        status: -1,
                        message: 'Error database Connection'
                    });
                } else {
                    res.status(200).json({
                        users: dbData.recordsets
                    });
                }
                //console.log(dbData);
            }).catch(err => console.log(err));
    });
}

let logOutUser = (res, user) => {
    var pool = new mssql.ConnectionPool(dbConfigAzure, (err) => {
        var transaction = new mssql.Transaction(pool);
        transaction
            .begin((err) => {
                var rollBack = false;
                transaction.on('rollback',
                    (aborted) => {
                        rollBack = true;
                    });
                new mssql
                    .Request(transaction)
                    .input('userId', mssql.Int, user.userId)
                    .input('tokenKey', mssql.Text, user.token)
                    .query('UPDATE DCS.Token SET TokenActive = 0 WHERE UserId = @userId and TokenKey Like @tokenKey and TokenActive = 1',
                        (err, recordset) => {
                            if (err) {
                                if (!rollBack) {
                                    transaction.rollback((err) => {
                                        pool.close();
                                        console.log(err)
                                    });
                                }
                            } else {
                                if (recordset.rowsAffected[0] == 1) {
                                    console.log(recordset);
                                    transaction
                                        .commit()
                                        .then((recordset) => {
                                            pool.close();
                                            res.json({
                                                status: 1,
                                                message: "logout successfully",
                                                userLogout: user
                                            });
                                        })
                                        .catch((err) => res.json({
                                            status: 0,
                                            message: "logout failed, There's been a problem",
                                        }));
                                } else {
                                    res.json({
                                        status: 2,
                                        message: "logout failed, The user already closed the session",
                                    })
                                }
                            }
                        });
            });

    });
}

let createUser = async(res, user) => {
    var pool = new mssql.ConnectionPool(dbConfigAzure, (err) => {
        var transact = new mssql.Transaction(pool);
        transact.begin((err) => {
            var rollback = false;
            transact.on('rollback', (aborted) => {
                rollback = true;
            });
            new mssql
                .Request(transact)
                .input('email', mssql.VarChar, user.email)
                .input('password', mssql.VarChar, user.password)
                .input('fullname', mssql.VarChar, user.fullname) // 1: Active
                .input('createdIn', mssql.DateTime, new Date())
                .query('insert into [DCS].[Users](UserName, UserPassword, UserFullName, CreatedIn) values(@email, @password, @fullname, @createdIn)', (err, recordSet) => {
                    if (err) {
                        if (!rollback) {
                            transact.rollback(err => {
                                pool.close();
                                console.log(err)
                            });
                        }
                    } else {
                        transact
                            .commit()
                            .then(async(recordSet) => {
                                let userCreated = await getLastUser();

                                let tokenGenerate = utils.randomToken(32);
                                await saveTokenUserLogin(tokenGenerate, userCreated.UserId);

                                res.json({
                                    status: 1,
                                    message: "user registered and logged successfully",
                                    userCreated: {
                                        UserId: userCreated.id,
                                        UserName: userCreated.UserName,
                                        UserFullName: userCreated.UserFullName,
                                        TokenKey: tokenGenerate
                                    }
                                });
                                //pool.close();
                                /*res.json({
                                    status: 1,
                                    message: "user created successfully",
                                    userCreated: userCreated
                                });*/
                            })
                            //.then(recordSet => console.log('Data inserted successfully', recordSet))
                            .catch(err => {
                                console.log(err);
                                res.json({
                                    status: 0,
                                    message: "An ocurred problem at creating user"
                                })
                            });
                    }
                });
        });
    });
}

let lastTokenSession = async() => {
    try {
        let pool = await new mssql.connect(dbConfigAzure);
        let result = await pool.query('select top(1) * from DCS.Token order by 1 desc');
        pool.close();
        return result;
    } catch (error) {
        console.log(error);
    }
};

let saveTokenUserLogin = async(token, userId) => {
    var pool = new mssql.ConnectionPool(dbConfigAzure, (err) => {
        var transact = new mssql.Transaction(pool);
        transact.begin((err) => {
            var rollback = false;
            transact.on('rollback', (aborted) => {
                rollback = true;
            });
            new mssql
                .Request(transact)
                .input('userId', mssql.Int, userId)
                .input('tokenKey', mssql.Text, token)
                .input('tokenActive', mssql.Int, 1) // 1: Active
                .input('createdIn', mssql.DateTime, new Date())
                .query('insert into [DCS].[Token](UserId, TokenKey, TokenActive, CreatedIn) values(@userId, @tokenKey, @tokenActive, @createdIn)', (err, recordSet) => {
                    if (err) {
                        if (!rollback) {
                            transact.rollback(err => {
                                pool.close();
                                console.log(err);
                            });
                        }
                    } else {
                        transact
                            .commit()
                            .then(recordSet => console.log('Record inserted successfully', recordSet))
                            //.then(recordSet => console.log('Data inserted successfully', recordSet))
                            .catch(err => console.log(err));
                    }
                });
        });
    });
}

let getLastUser = async() => {
    try {
        let pool = await mssql.connect(dbConfigAzure);
        let result = await pool.query('select top(1)* from DCS.Users order by 1 desc');
        //console.log(result);
        return result.recordset[0];
    } catch (err) {
        console.log(err);
    }
}

let getOpportunitiesOffered = async(res, userId) => {
    try {
        let pool = await mssql.connect(dbConfigAzure);
        let result = await pool.request()
            .input('userId', mssql.Int, userId)
            .execute('DCS.sp_GetAllOportunitiesOffered', (err, result) => {
                res.json({
                    status: 1,
                    opportunities: result.recordset
                });
            })
            .catch(err => { // Provisional
                res.json({
                    status: -1,
                    message: "Error database connection"
                })
                console.log(err)
            })
            /*res.json({
                status: 1,
                opportunities: result.recordSet
            });*/
    } catch (error) {
        console.log(error);
        res.json({
            status: -1,
            message: "Error database connection",
            error: error
        });
    }
}


//#endregion

//#region  "API: Other"
app.get('/tokenRandom/', (req, res) => {

    res.status(200)
        .json({
            token: randomToken(16)
        });

});

//#endregion

app.listen(3000, () => {
    console.log('Server in port 3000');
});