var app = require('./index');
var path = require('path');
var control = require('./control');
var model = require('./model');
var check_login = control.check_login;

// Picture resource
app.get('/items/:iid/pictures/:p', function(req, res){
	var iid = req.params.iid;
	var p = req.params.p;
	model.Item.get(iid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var item = result.item;
		var i = item.pictures.indexOf(p);
		if(i < 0)return res.send({feedback: 'Failure'});
		res.sendFile(path.join(__dirname, '..', 'uploads', item._id.toString(), p+'.jpg'));
	});
});
app.get('/items/:iid/thumbnails/:p', function(req, res){
	var iid = req.params.iid;
	var p = req.params.p;
	model.Item.get(iid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var item = result.item;
		var i = item.pictures.indexOf(p);
		if(i < 0)return res.send({feedback: 'Failure'});
		res.sendFile(path.join(__dirname, '..', 'uploads', item._id.toString(), p+'_thumbnail.jpg'));
	});
});

// Comment resource
app.get('/items/:iid/comments', function(req, res){
	var iid = req.params.iid;
	model.Item.get(iid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var item = result.item;
		item.populate('comment_id', function(err, item){
			if(err)return res.send({feedback: 'Failure'});
			res.send(item.comment_id.comments);
		});
	})
})
app.post('/items/:iid/comments', function(req, res){
	if(!check_login(req, res))return;
	var iid = req.params.iid;
	var content = req.body.content;
	var uid = req.session.uid;
	model.User.get(uid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var user = result.user;
		user.comment({iid: iid, content: content}, function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			return res.send({feedback: 'Success'});
		})
	})
});
