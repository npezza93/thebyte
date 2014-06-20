jQuery(function($, undefined) {
    $('#term_demo').terminal({
        echo: function(arg1) {
            this.echo(arg1);
        },
        print: function(arg1) {
            this.echo(arg1);
        },
        add: function (a,b) {
            this.echo(a+b);
        }, 
        clear: function() {
            clear();
        },
        resize: function(a,b) {
            this.resize(a, b);
        },
        google: function() {
            window.open('http://www.google.com', '_blank');
        },
        twitter: function() {
            window.open('http://www.twitter.com', '_blank');
        },
        youtube: function() {
             window.open('http://www.youtube.com', '_blank');
        },
        facebook: function() {
             window.open('http://www.facebook.com', '_blank');
        },
        home: function() {
            var root = location.protocol + '//' + location.host;
            window.location.href =root;
        }

    }, {
        greetings: 'eeeee e   e eeee   eeeee  e    e eeeee eeee \n  8   8   8 8      8   8  8    8   8   8    \n  8e  8eee8 8eee   8eee8e 8eeee8   8e  8eee \n  88  88  8 88     88   8   88     88  88   \n  88  88  8 88ee   88eee8   88     88  88ee \n',
        name: 'the_byte',
        height: 100,
        prompt: '>'});

});

// ' ______ __  __  ______       ______  __  __  ______ ______    \n/\\__  _/\\ \\_\\ \\/\\  ___\\     /\\  == \\/\\ \\_\\ \\/\\__  _/\\  ___\\   \n\\/_/\\ \\\\ \\  __ \\ \\  __\\     \\ \\  __<\\ \\____ \\/_/\\ \\\\ \\  __\\   \n   \\ \\_\\\\ \\_\\ \\_\\ \\_____\\    \\ \\_____\\/\\_____\\ \\ \\_\\\\ \\_____\\ \n    \\/_/ \\/_/\\/_/\\/_____/     \\/_____/\\/_____/  \\/_/ \\/_____/\n',