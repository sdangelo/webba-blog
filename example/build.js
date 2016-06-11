#!/usr/bin/env node

var Webba = require("webba");
Webba.init(__dirname);
require("../webba-blog.js")(Webba);

Webba.Crea.createPhonyTask("default",
	["pages", "posts", "blogIndex", "blogFeeds", "extra"]);

Webba.Crea.run(process.argv[2] ? process.argv[2] : "default");
