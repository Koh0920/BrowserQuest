var cls = require("./lib/class"),
    fs = require("fs"),
    http = require("http"),
    path = require("path"),
    url = require("url"),
    WebSocketServer = require("websocket").server,
    Utils = require("./utils"),
    _ = require("underscore"),
    WS = {};

module.exports = WS;

var CLIENT_ROOT = path.resolve(__dirname, "../../client");
var SHARED_ROOT = path.resolve(__dirname, "../../shared");
var UPSTREAM_COMMIT = "af32d247cac3495ca430d0effbb88dd5f3250b2c";
var MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpg": "image/jpeg",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".png": "image/png"
};

function writeJson(response, status, payload) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    });
    response.end(JSON.stringify(payload));
}

function serveClientFile(request, response) {
    var pathname = decodeURIComponent(url.parse(request.url).pathname),
        isShared = pathname.indexOf("/shared/") === 0,
        root = isShared ? SHARED_ROOT : CLIENT_ROOT,
        relativePath = pathname === "/" ? "index.html" :
            (isShared ? pathname.replace(/^\/shared\/+/, "") : pathname.replace(/^\/+/, "")),
        filePath = path.resolve(root, relativePath);

    if(filePath !== root && filePath.indexOf(root + path.sep) !== 0) {
        response.writeHead(403);
        response.end();
        return;
    }

    fs.stat(filePath, function(statError, stats) {
        if(statError || !stats.isFile()) {
            response.writeHead(404);
            response.end("Not found");
            return;
        }

        response.writeHead(200, {
            "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
            "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
            "X-Content-Type-Options": "nosniff"
        });
        fs.createReadStream(filePath).pipe(response);
    });
}

var Server = cls.Class.extend({
    init: function(port) {
        this.port = port;
    },

    onConnect: function(callback) {
        this.connection_callback = callback;
    },

    onError: function(callback) {
        this.error_callback = callback;
    },

    forEachConnection: function(callback) {
        _.each(this._connections, callback);
    },

    addConnection: function(connection) {
        this._connections[connection.id] = connection;
    },

    removeConnection: function(id) {
        delete this._connections[id];
    },

    getConnection: function(id) {
        return this._connections[id];
    }
});

var Connection = cls.Class.extend({
    init: function(id, connection, server) {
        this._connection = connection;
        this._server = server;
        this.id = id;
    },

    onClose: function(callback) {
        this.close_callback = callback;
    },

    listen: function(callback) {
        this.listen_callback = callback;
    },

    send: function(message) {
        this.sendUTF8(JSON.stringify(message));
    },

    sendUTF8: function(data) {
        this._connection.sendUTF(data);
    },

    close: function(logError) {
        log.info("Closing connection to " + this._connection.remoteAddress + ". Error: " + logError);
        this._connection.close();
    }
});

WS.MultiVersionWebsocketServer = Server.extend({
    _connections: {},
    _counter: 0,

    init: function(port) {
        var self = this;

        this._super(port);
        this._connections = {};

        this._httpServer = http.createServer(function(request, response) {
            var pathname = url.parse(request.url).pathname;

            if(pathname === "/status") {
                response.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
                response.end(self.status_callback ? self.status_callback() : "[]");
                return;
            }

            if(pathname === "/ato-state") {
                writeJson(response, 200, {
                    app: "browserquest",
                    upstream_commit: UPSTREAM_COMMIT,
                    primary_screen: "live_game",
                    websocket: true,
                    seeded_player: "Ato Explorer",
                    external_integrations: false
                });
                return;
            }

            if(pathname === "/" && url.parse(request.url, true).query["ato-demo"] !== "1") {
                response.writeHead(302, {Location: "/?ato-demo=1"});
                response.end();
                return;
            }

            serveClientFile(request, response);
        });

        this._httpServer.listen(port, "0.0.0.0", function() {
            log.info("Server is listening on port " + port);
        });

        this._websocketServer = new WebSocketServer({
            httpServer: this._httpServer,
            autoAcceptConnections: false,
            maxReceivedFrameSize: 0x10000,
            maxReceivedMessageSize: 0x100000
        });

        this._websocketServer.on("request", function(request) {
            var connection;

            try {
                connection = request.accept(null, request.origin);
                connection.remoteAddress = request.remoteAddress;
                var wrapped = new Connection(self._createId(), connection, self);

                connection.on("message", function(message) {
                    if(wrapped.listen_callback && message.type === "utf8") {
                        try {
                            wrapped.listen_callback(JSON.parse(message.utf8Data));
                        } catch(error) {
                            wrapped.close("Received message was not valid JSON.");
                        }
                    }
                });

                connection.on("close", function() {
                    if(wrapped.close_callback) {
                        wrapped.close_callback();
                    }
                    self.removeConnection(wrapped.id);
                });

                if(self.connection_callback) {
                    self.connection_callback(wrapped);
                }
                self.addConnection(wrapped);
            } catch(error) {
                if(self.error_callback) {
                    self.error_callback(error);
                }
            }
        });
    },

    _createId: function() {
        return "5" + Utils.random(99) + "" + (this._counter++);
    },

    broadcast: function(message) {
        this.forEachConnection(function(connection) {
            connection.send(message);
        });
    },

    onRequestStatus: function(status_callback) {
        this.status_callback = status_callback;
    }
});
