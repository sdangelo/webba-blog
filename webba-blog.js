/*
 * Copyright (C) 2016 Stefano D'Angelo <zanga.mail@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

module.exports = function (Webba, opt) {
	Webba.Marca.DOMElementEndPreview =
		Object.create(Webba.Marca.DOMElementThrowAway);
	Webba.Marca.DOMElementEndPreview.process =
	function (parent, position) {
		parent.endPreview = position;
	};
	Webba.Marca.HypertextElementProtos.endpreview =
		Webba.Marca.DOMElementEndPreview;

	var postData = {};
	function parsePost (post, url, postFile, commentsFile) {
		if (post in postData)
			return;

		console.log("Parsing blog post " + post);

		var root = Webba.Marca.parse(Webba.Crea.fs.readFileSync(
				Webba.getTopPath(postFile), "utf8"));
		var dom = Object.create(Webba.Marca.DOMElementHypertextRoot);
		dom.init(root, Webba.Marca.HypertextElementProtos);
		dom.meta.published = new Date(dom.meta.published);
		dom.meta.edited = new Date(dom.meta.edited);

		var commentsRoot = Webba.Marca.parse(
					Webba.Crea.fs.readFileSync(
						Webba.getTopPath(commentsFile),
						"utf8"));

		var domp = dom;
		if (domp.endPreview) {
			domp = Object.create(dom);
			domp.children = domp.children.slice(0, domp.endPreview);
		}

		postData[post] = { url: url, dom: dom, domPreview: domp,
				   commentsRoots: [] };

		for (var i = 0; i < commentsRoot.children.length; i++) {
			var c = commentsRoot.children[i];
			if (typeof c == "string")
				continue;

			postData[post].commentsRoots.push(c);
		}
	}

	var postsDir = Webba.path.join("content", "posts");
	var postsTargets = [];
	var posts = Webba.Crea.fs.readdirSync(Webba.getTopPath(postsDir))
			 .filter(function (value) {
					return /.post.marca$/.test(value);
				 });
	var postFiles = new Array(posts.length);
	var commentsFiles = new Array(posts.length);
	var postUrls = new Array(posts.length);
	var postUrlFunc = opt ? opt.postUrl : null;
	var postOutFileFunc = opt ? opt.postOutFile : null;
	for (var i = 0; i < posts.length; i++) {
		(function(){
		var post = posts[i].slice(0, -11);
		var postFile = Webba.path.join(postsDir, post + ".post.marca");
		var commentsFile = Webba.path.join(postsDir,
						   post + ".comments.marca");
		var url = postUrlFunc ? postUrlFunc(Webba, post)
				      : "blog/" + post + ".html";
		var outFile = Webba.path.join("build", "out",
				postOutFileFunc
				? postOutFileFunc(Webba, post)
				: Webba.path.join("blog", post + ".html"));
		var depFile = Webba.path.join("build", "deps", "blog",
					      post + ".json");
		posts[i] = post;
		postFiles[i] = postFile;
		commentsFiles[i] = commentsFile;
		postUrls[i] = url;

		Webba.Crea.createFileTaskWithDeps(outFile,
			[Webba.pageTemplateFile, postFile, commentsFile],
			function () {
				Webba.parsePageTemplate();
				parsePost(post, url, postFile, commentsFile);
				console.log("Generating blog post " + post);
				var d = postData[post];
				Webba.generatePage(url, d.dom, outFile,
					function (data) {
						data.comments = [];
						for (var i = 0; i < d.commentsRoots.length; i++) {
							var dom = Object.create(Webba.Marca.DOMElementHypertextRoot);
							dom.init(d.commentsRoots[i], Webba.Marca.HypertextElementProtos);
							data.comments.push({
								submitted: new Date(dom.meta.submitted),
								published: new Date(dom.meta.published),
								edited: new Date(dom.meta.edited),
								author: dom.meta.author,
								dom: dom
							});
						}
					});
			},
			depFile,
			function () {
				parsePost(post, url, postFile, commentsFile);
				return Webba.getPageDeps(postData[post].dom);
			});
		postsTargets.push(outFile);
		})();
	}
	Webba.Crea.createPhonyTask("posts", postsTargets);

	var postDataSorted = null;
	function sortPostData () {
		if (postDataSorted)
			return;
		postDataSorted = [];

		for (var i = 0; i < posts.length; i++)
			parsePost(posts[i], postUrls[i], postFiles[i],
				  commentsFiles[i]);

		var i = 0;
		for (var p in postData) {
			postDataSorted[i] = postData[p];
			i++;
		}
		postDataSorted.sort(function (a,b) {
			return b.dom.meta.published - a.dom.meta.published;
		});
	};

	var indexTargets = [];
	var nIndexPages = Math.ceil(posts.length / 10);
	var indexUrlFunc = opt ? opt.blogIndexUrl : null;
	var indexOutFileFunc = opt ? opt.blogIndexOutFile : null;
	for (var i = 0; i < nIndexPages; i++) {
		(function(){
		var pageIndex = i;
		var pageNo = i + 1;
		var url = indexUrlFunc
			  ? indexUrlFunc(Webba, pageIndex)
			  : "blog/index" + (pageIndex ? pageNo : "") + ".html";
		var outFile = Webba.path.join("build", "out",
				indexOutFileFunc
				? indexOutFileFunc(Webba, pageIndex)
				: Webba.path.join("blog",
					"index" + (pageIndex ? pageNo : "")
					+ ".html"));
		Webba.Crea.createFileTask(outFile,
			[Webba.pageTemplateFile].concat(postFiles, commentsFiles),
			function () {
				Webba.parsePageTemplate();
				sortPostData();

				console.log("Generating blog index page "
					    + pageNo);

				var data = {
					blogIndex:	postDataSorted.slice(
							    pageIndex * 10,
							    pageNo * 10 - 1),
					title:		"Blog index, page "
							+ pageNo,
					url:		url,
					Webba:		Webba };

				Webba.Crea.fs.outputFileSync(outFile,
					Webba.pageTemplate(data));
			});
		indexTargets.push(outFile);
		})();
	}
	Webba.Crea.createPhonyTask("blogIndex", indexTargets);

	var atomFeedTemplateFile = Webba.path.join("templates", "atom.dot");
	var atomFeedOutFile = Webba.path.join("build", "out",
				opt && opt.feedOutFile
				? opt.atomFeedOutFile
				: Webba.path.join("feeds", "blog-atom.xml"));
	Webba.Crea.createFileTask(atomFeedOutFile,
		[atomFeedTemplateFile].concat(postFiles, commentsFiles),
		function () {
			sortPostData();
			console.log("Generating Atom blog feed");
			var template = Webba.doT.template(
				Webba.Crea.fs.readFileSync(
					Webba.getTopPath(atomFeedTemplateFile),
					"utf8"));
			Webba.Crea.fs.outputFileSync(atomFeedOutFile,
				template({ items:	postDataSorted,
					   Webba:	Webba }));
		});

	var rssFeedTemplateFile = Webba.path.join("templates", "rss.dot");
	var rssFeedOutFile = Webba.path.join("build", "out",
				opt && opt.feedOutFile
				? opt.rssFeedOutFile
				: Webba.path.join("feeds", "blog-rss.xml"));
	Webba.Crea.createFileTask(rssFeedOutFile,
		[rssFeedTemplateFile].concat(postFiles, commentsFiles),
		function () {
			sortPostData();
			console.log("Generating RSS blog feed");
			var template = Webba.doT.template(
				Webba.Crea.fs.readFileSync(
					Webba.getTopPath(rssFeedTemplateFile),
					"utf8"));
			Webba.Crea.fs.outputFileSync(rssFeedOutFile,
				template({ items:	postDataSorted,
					   Webba:	Webba }));
		});

	Webba.Crea.createPhonyTask("blogFeeds",
				   [atomFeedOutFile, rssFeedOutFile]);
};
