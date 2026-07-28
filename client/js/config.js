
define(function() {
    var sameOrigin = {
            host: window.location.hostname,
            port: window.location.port || (window.location.protocol === "https:" ? 443 : 80),
            dispatcher: false
        },
        config = {
        dev: sameOrigin,
        local: sameOrigin,
        build: sameOrigin
    };
    
    return config;
});
