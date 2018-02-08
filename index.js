'use strict';
var everyauth = require('everyauth');
var loginUtils = require('./node-backend/loginUtils');
var logger = require('./node-backend/logger');
var dbUri = 'postgres://' + process.env.MCDAWEB_DB_USER + ':' + process.env.MCDAWEB_DB_PASSWORD + '@' + process.env.MCDAWEB_DB_HOST + '/' + process.env.MCDAWEB_DB_NAME; // FIXME
console.log(dbUri);
var db = require('./node-backend/db')(dbUri);
var patavi = require('./node-backend/patavi');
var util = require('./node-backend/util');
var async = require('async');

var express = require('express'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  session = require('express-session'),
  csurf = require('csurf');

everyauth.everymodule.findUserById(function(id, callback) {
  db.query('SELECT id, username, firstName, lastName FROM Account WHERE id = $1', [id], function(error, result) {
    if (error) {
      callback(error);
    } else if (result.rows.length === 0) {
      callback('ID ' + id + ' not found');
    } else {
      callback(null, result.rows[0]);
    }
  });
});

function findOrCreateUser(sess, accessToken, extra, googleUser) {
  var user = this.Promise();

  function userTransaction(client, callback) {
    client.query("SELECT id, username, firstName, lastName FROM UserConnection LEFT JOIN Account ON UserConnection.userid = Account.username WHERE providerUserId = $1 AND providerId = 'google'", [googleUser.id], function(error, result) {
      if (error) {
        return callback(error);
      }
      if (result.rows.length === 0) {
        client.query("INSERT INTO UserConnection (userId, providerId, providerUserId, rank, displayName, profileUrl, accessToken, refreshToken, expireTime)" +
          " VALUES ($1, 'google', $2, 1, $3, $4, $5, $6, $7)", [googleUser.id, googleUser.id, googleUser.name, googleUser.link, accessToken, extra.refresh_token, extra.expires_in],
          function(error) {
            if (error) {
              return callback(error);
            }
            client.query("INSERT INTO Account (username, firstName, lastName) VALUES ($1, $2, $3) RETURNING id", [googleUser.id, googleUser.given_name, googleUser.family_name],
              function(error, result) {
                if (error) {
                  return callback(error);
                }
                var row = result.rows[0];
                return callback(null, {
                  'id': row.id,
                  'username': googleUser.id,
                  'firstName': googleUser.given_name,
                  'lastName': googleUser.family_name
                });
              });
          });
      } else {
        callback(null, result.rows[0]);
      }
    });
  }

  db.runInTransaction(userTransaction, function(error, result) {
    if (error) {
      return user.fail(error);
    }
    user.fulfill(result);
  });

  return user;
}

everyauth.google
  .myHostname(process.env.MCDA_HOST)
  .authQueryParam({
    approval_prompt: 'auto'
  })
  .appId(process.env.MCDAWEB_GOOGLE_KEY)
  .appSecret(process.env.MCDAWEB_GOOGLE_SECRET)
  .scope('https://www.googleapis.com/auth/userinfo.profile email')
  .findOrCreateUser(findOrCreateUser)
  .redirectPath('/');

var bower_path = '/bower_components';
var app = express();
app
  .use(express.static('manual'))
  .use('/bower_components', express.static(__dirname + '/bower_components'))
  .use(express.static('app'))
  .use('/template', express.static(__dirname + bower_path + '/angular-foundation-assets/template'))
  .use('/examples', express.static(__dirname + '/examples'))
  .use(bodyParser())
  .use(cookieParser('very secret secret'))
  .use(session())
  .use(everyauth.middleware(app))
  .use(csurf({
    cookie: true
  }));

function requireUserIsWorkspaceOwner(req, res, next) {
  db.query('SELECT owner FROM workspace WHERE id = $1', [req.params.id], function(err, result) {
    if (err) {
      err.status = 500;
      next(err);
    }
    if (!req.user || result.rows[0].owner !== req.user.id) {
      res.status(403).send({
        'code': 403,
        'message': 'Access to resource not authorised'
      });
    } else {
      next();
    }
  });
}

function requireUserIsInProgressWorkspaceOwner(req, res, next) {
  db.query('SELECT owner FROM inProgressWorkspace WHERE id = $1', [req.params.id], function(err, result) {
    if (err) {
      err.status = 500;
      next(err);
    }
    if (!req.user || result.rows[0].owner !== req.user.id) {
      res.status(403).send({
        'code': 403,
        'message': 'Access to resource not authorised'
      });
    } else {
      next();
    }
  });
}

var router = express.Router();
router.get('/workspaces/:id*', requireUserIsWorkspaceOwner);
router.post('/workspaces/:id*', requireUserIsWorkspaceOwner);
router.delete('/workspaces/:id*', requireUserIsWorkspaceOwner);
router.get('/workspaces/inProgress/:id', requireUserIsInProgressWorkspaceOwner);
router.put('/workspaces/inProgress/:id', requireUserIsInProgressWorkspaceOwner);
router.put('/workspaces/:id/ordering', requireUserIsWorkspaceOwner);
router.put('/workspaces/:id/toggledColumns', requireUserIsWorkspaceOwner);
router.delete('/workspaces/inProgress/:id', requireUserIsInProgressWorkspaceOwner);
app.use(router);

app.use(function(req, res, next) {
  res.cookie('XSRF-TOKEN', req.csrfToken());
  if (req.user) {
    res.cookie('LOGGED-IN-USER', JSON.stringify(req.user));
  }
  next();
});

app.get('/', function(req, res) {
  if (req.user) {
    res.sendfile(__dirname + '/public/index.html');
  } else {
    res.redirect('/signin');
  }
});

app.get('/signin', function(req, res) {
  res.sendfile(__dirname + '/public/signin.html');
});

// Workspaces in progress

app.post('/inProgress', function(req, res, next) {
  logger.debug('creating in-progress workspace');

  db.query('INSERT INTO inProgressWorkspace (owner, state) VALUES ($1, $2) RETURNING id', [req.user.id, req.body], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json({ id: result.rows[0].id });
  });
});

app.put('/inProgress/:id', function(req, res, next) {
  logger.debug('updating in-progress workspace');
  db.query('UPDATE inProgressWorkspace SET state = $1 WHERE id = $2 ', [req.body, req.params.id], function(err) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.end();
  });
});

app.get('/inProgress/:id', function(req, res, next) {
  logger.debug('GET /inProgress/:id');
  db.query('SELECT id, owner, state FROM inProgressWorkspace WHERE id = $1', [req.params.id], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json(result.rows[0]);
  });
});

app.get('/inProgress', function(req, res, next) {
  logger.debug('GET /inProgress/');
  db.query('SELECT id, owner, state FROM inProgressWorkspace WHERE owner = $1', [req.user.id], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json(result.rows);
  });
});

app.delete('/inProgress/:id', function(req, res, next) {
  db.query('DELETE FROM inProgressWorkspace WHERE id=$1', [req.params.id], function(err) {
    if (err) {
      logger.debug('error deleting workspace in progress');
      err.status = 500;
      return next(err);
    }
    res.end();
  });
});


// Complete workspaces
app.get('/workspaces', function(req, res, next) {
  logger.debug('GET /workspaces');
  db.query('SELECT id, owner, title, problem, defaultSubProblemId as "defaultSubProblemId", defaultScenarioId AS "defaultScenarioId" FROM Workspace WHERE owner = $1', [req.user.id], function(err, result) {
    if (err) {
      logger.error('error running query', err);
      next({
        statusCode: 500,
        message: err
      });
    }
    res.json(result.rows);
  });
});

app.post('/workspaces', function(req, res, next) {
  logger.debug('POST /workspaces');

  function workspaceTransaction(client, callback) {
    function createWorkspace(callback) {
      logger.debug('creating workspace');

      // create a new workspace
      client.query('INSERT INTO workspace (owner, title, problem) VALUES ($1, $2, $3) RETURNING id', [req.user.id, req.body.title, req.body.problem], function(err, result) {
        if (err) {
          return callback(err);
        }
        callback(null, result.rows[0].id);
      });
    }

    function createSubProblem(workspaceId, callback) {
      logger.debug('creating subproblem');
      var definition = {
        ranges: util.getRanges(req.body.problem)
      };
      logger.debug('created definition ' + JSON.stringify(definition));
      client.query('INSERT INTO subProblem (workspaceid, title, definition) VALUES ($1, $2, $3) RETURNING id', [workspaceId, 'Default', definition], function(err, result) {
        if (err) {
          logger.debug('error creating subproblem');
          return callback(err);
        }
        logger.debug('done creating subproblem');
        callback(null, workspaceId, result.rows[0].id);
      });
    }

    function setDefaultSubProblem(workspaceId, subProblemId, callback) {
      logger.debug('setting default subproblem');
      client.query('UPDATE workspace SET defaultsubproblemId = $1 WHERE id = $2', [subProblemId, workspaceId], function(err) {
        callback(err, workspaceId, subProblemId);
      });
    }

    function createScenario(workspaceId, subProblemId, callback) {
      logger.debug('creating scenario');
      var state = {
        problem: util.reduceProblem(req.body.problem)
      };
      client.query('INSERT INTO scenario (workspace, subproblemId, title, state) VALUES ($1, $2, $3, $4) RETURNING id', [workspaceId, subProblemId, 'Default', state], function(err, result) {
        if (err) {
          return callback(err);
        }
        callback(null, workspaceId, result.rows[0].id);
      });
    }

    function setDefaultScenario(workspaceId, scenarioId, callback) {
      logger.debug('setting default scenario');
      client.query('UPDATE workspace SET defaultScenarioId = $1 WHERE id = $2', [scenarioId, workspaceId], function(err) {
        callback(err, workspaceId);
      });
    }

    function getWorkspaceInfo(workspaceId, callback) {
      logger.debug('getting workspace info');
      client.query('SELECT id, owner, problem, defaultSubProblemId as "defaultSubProblemId", defaultScenarioId AS "defaultScenarioId" FROM workspace WHERE id = $1', [workspaceId], function(err, result) {
        if (err) {
          return callback(err);
        }
        callback(null, result.rows[0]);
      });
    }

    async.waterfall([
      createWorkspace,
      createSubProblem,
      setDefaultSubProblem,
      createScenario,
      setDefaultScenario,
      getWorkspaceInfo
    ], callback);
  }

  db.runInTransaction(workspaceTransaction, function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json(result);
  });
});

app.get('/workspaces/:id', function(req, res, next) {
  logger.debug('GET /workspaces/:id');
  db.query('SELECT id, owner, problem, defaultSubProblemId as "defaultSubProblemId", defaultScenarioId AS "defaultScenarioId" FROM workspace WHERE id = $1', [req.params.id], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json(result.rows[0]);
  });
});

app.post('/workspaces/:id', function(req, res, next) {
  db.query('UPDATE workspace SET title = $1, problem = $2 WHERE id = $3 ', [req.body.problem.title, req.body.problem, req.params.id], function(err) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.end();
  });
});

app.delete('/workspaces/:id', function(req, res, next) {
  logger.debug('DELETE /workspaces/:id');

  function deleteWorkspace(client, callback) {
    function deleteSubproblems(callback) {
      client.query('DELETE FROM subproblem WHERE workspaceid=$1', [req.params.id], function(err) {
        if (err) {
          logger.debug('error deleting subproblem');
          return callback(err);
        }
        logger.debug('done deleting subproblem');
        callback(null, req.params.id);
      });
    }

    function deleteScenarios() {
      client.query('DELETE FROM scenario WHERE workspace=$1', [req.params.id], function(err) {
        if (err) {
          logger.debug('error deleting scenario');
          return callback(err);
        }
        logger.debug('done deleting scenario');
        callback(null, req.params.id);
      });
    }

    function deleteWorkspaceRemnants() {
      client.query('DELETE FROM scenario WHERE workspace=$1;DELETE FROM workspace WHERE id=$1', [req.params.id], function(err) {
        if (err) {
          logger.debug('error deleting workspace');
          return callback(err);
        }
        logger.debug('done deleting workspace');
        callback(null, req.params.id);
      });
    }
    async.waterfall([
      deleteSubproblems,
      deleteScenarios,
      deleteWorkspaceRemnants
    ], callback);
  }

  db.runInTransaction(deleteWorkspace, function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json(result);
  });

});

// Orderings
app.get('/workspaces/:workspaceId/ordering', function(req, res, next) {
  logger.debug('GET /workspaces/' + req.params.workspaceId + '/ordering');
  db.query('SELECT workspaceId AS "workspaceId", ordering FROM ordering WHERE workspaceId = $1', [req.params.workspaceId], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json({
      ordering: result.rows[0] ? result.rows[0].ordering : undefined
    });
  });
});

app.put('/workspaces/:workspaceId/ordering', function(req, res, next) {
  logger.debug('SET /workspaces/' + req.params.workspaceId + '/ordering/');
  db.query('insert into ordering(workspaceId, ordering) values($1, $2) ON CONFLICT(workspaceId) DO UPDATE SET ordering=$2', [
    req.params.workspaceId,
    req.body
  ], function(err) {
    if (err) {
      err.status = 500;
      next(err);
    }
    res.end();
  });
});

//Effects table non-alternative columns
app.get('/workspaces/:workspaceId/toggledColumns', function(req, res, next) {
  logger.debug('GET /workspaces/' + req.params.workspaceId + '/toggledColumns');
  db.query('SELECT toggledColumns AS "toggledColumns", toggledColumns FROM toggledColumns WHERE workspaceId = $1', [req.params.workspaceId], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json({
      toggledColumns: result.rows[0] ? result.rows[0].toggledColumns : undefined
    });
  });
});

app.put('/workspaces/:workspaceId/toggledColumns', function(req, res, next) {
  logger.debug('POST /workspaces/' + req.params.workspaceId + '/toggledColumns');
  db.query('INSERT INTO toggledColumns (workspaceid, toggledColumns) VALUES ($1, $2) ON CONFLICT(workspaceId) DO UPDATE SET toggledColumns=$2', [req.params.workspaceId, req.body.toggledColumns], function(err) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.end();
  });
});

//Subproblems
app.get('/workspaces/:workspaceId/problems', function(req, res, next) {
  logger.debug('GET /workspaces/:id1/subProblem/:id2/scenarios');
  db.query('SELECT id, workspaceId AS "workspaceId", title, definition FROM subProblem WHERE workspaceId = $1', [req.params.workspaceId], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json(result.rows);
  });
});

app.get('/workspaces/:workspaceId/problems/:subProblemId', function(req, res, next) {
  logger.debug('GET /workspaces/:id/problems/:subProblemId');
  db.query('SELECT id, workspaceId AS "workspaceId", title, definition FROM subProblem WHERE workspaceId = $1 AND id = $2', [
    req.params.workspaceId, req.params.subProblemId
  ], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json(result.rows[0]);
  });
});

app.post('/workspaces/:workspaceId/problems', function(req, res, next) {
  logger.debug('POST /workspaces/:workspaceId/problems');

  function subProblemTransaction(client, transactionCallback) {

    function createSubProblem(callback) {
      logger.debug('creating subproblem');
      client.query('INSERT INTO subProblem (workspaceid, title, definition) VALUES ($1, $2, $3) RETURNING id', [req.params.workspaceId, req.body.title, req.body.definition], function(err, result) {
        if (err) {
          logger.debug('error creating subproblem');
          return callback(err);
        }
        logger.debug('done creating subproblem');
        callback(null, req.params.workspaceId, result.rows[0].id);
      });
    }

    function createScenario(workspaceId, subProblemId, callback) {
      logger.debug('creating scenario; workspaceid: ' + workspaceId + ', subProblemId: ' + subProblemId);
      client.query('INSERT INTO scenario (workspace, subProblemId, title, state) VALUES ($1, $2, $3, $4) RETURNING id', [workspaceId, subProblemId, 'Default', req.body.scenarioState], function(err) {
        if (err) {
          return callback(err);
        }
        callback(null, subProblemId);
      });
    }

    function getSubProblem(subProblemId, callback) {
      logger.debug('getting subproblem, subProblemId: ' + subProblemId);
      client.query('SELECT * FROM subProblem WHERE id = $1', [subProblemId], function(err, result) {
        if (err) {
          err.status = 500;
          return next(err);
        }
        logger.debug('found subproblem + ' + JSON.stringify(result));
        callback(null, result.rows[0]);
      });
    }

    async.waterfall([
      createSubProblem,
      createScenario,
      getSubProblem
    ], transactionCallback);
  }

  db.runInTransaction(subProblemTransaction, function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    logger.debug('done creating subProblem : ' + JSON.stringify(result));
    res.json(result);
  });
});

app.post('/workspaces/:workspaceId/problems/:subProblemId', function(req, res, next) {
  logger.debug('UPDATE /workspaces/:id/problems/:subProblemId');
  db.query('UPDATE subProblem SET definition = $1, title = $2 WHERE id = $3', [
    req.body.definition,
    req.body.title,
    req.params.subProblemId
  ], function(err) {
    if (err) {
      err.status = 500;
      next(err);
    }
    res.end();
  });
});

//Scenarios
app.get('/workspaces/:workspaceId/scenarios', function(req, res, next) {
  logger.debug('GET /workspaces/scenarios');
  db.query('SELECT id, title, state, subproblemId AS "subProblemId", workspace AS "workspaceId" FROM scenario WHERE workspace = $1', [req.params.workspaceId], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json(result.rows);
  });
});

app.get('/workspaces/:workspaceId/problems/:subProblemId/scenarios', function(req, res, next) {
  logger.debug('GET /workspaces/:id1/subProblem/:id2/scenarios');
  db.query('SELECT id, title, state, subproblemId AS "subProblemId", workspace AS "workspaceId" FROM scenario WHERE workspace = $1 AND subProblemId = $2', [req.params.workspaceId, req.params.subProblemId], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json(result.rows);
  });
});

app.get('/workspaces/:workspaceId/problems/:subProblemId/scenarios/:id', function(req, res, next) {
  logger.debug('GET /workspaces/:id/scenarios/:id');
  db.query('SELECT id, title, state, subproblemId AS "subProblemId", workspace AS "workspaceId" FROM scenario WHERE id = $1', [req.params.id], function(err, result) {
    if (err) {
      err.status = 500;
      return next(err);
    }
    res.json(result.rows[0]);
  });
});

app.post('/workspaces/:workspaceId/problems/:subProblemId/scenarios', function(req, res, next) {
  db.query('INSERT INTO scenario (workspace, subProblemId, title, state) VALUES ($1, $2, $3, $4) RETURNING id', [req.params.workspaceId, req.params.subProblemId, req.body.title, {
    problem: req.body.state.problem,
    prefs: req.body.state.prefs
  }], function(err, result) {
    if (err) {
      err.status = 500;
      next(err);
    }
    res.json(result.rows[0]);
  });
});

app.post('/workspaces/:workspaceId/problems/:subProblemId/scenarios/:id', function(req, res, next) {
  logger.debug('updating scenario :id');
  db.query('UPDATE scenario SET state = $1, title = $2 WHERE id = $3', [{
      problem: req.body.state.problem,
      prefs: req.body.state.prefs,
      legend: req.body.state.legend
    },
    req.body.title, req.body.id
  ], function(err) {
    if (err) {
      err.status = 500;
      next(err);
    }
    res.end();
  });
});

// rest
app.post('/patavi', function(req, res, next) { // FIXME: separate routes for scales and results
  patavi.create(req.body, function(err, taskUri) {
    if (err) {
      next({
        err: err,
        status: 500
      });
    }
    res.location(taskUri);
    res.status(201);
    res.json({
      'href': taskUri
    });
  });
});

app.get('/user', loginUtils.emailHashMiddleware);

//FIXME: should not be needed?
app.get('/main.js', function(req, res) {
  res.sendfile(__dirname + '/app/js/main.js');
});

//The 404 Route (ALWAYS Keep this as the last route)
app.get('*', function(req, res) {
  res.status(404).sendfile(__dirname + '/public/error.html');
});


var port = 8080;
if (process.argv[2] === 'port' && process.argv[3]) {
  port = process.argv[3];
}

app.listen(port, function() {
  console.log('Listening on http://localhost:' + port);
});