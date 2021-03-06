var app = require('./index');
var path = require('path');
var control = require('./control');
var model = require('./model_ext');
var check_login = control.check_login;
var async = require('async');

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
//get the thumbnail of an item picture
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
	//first check whether the item exists
	model.Item.get(iid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var item = result.item;
		//replace the comment_id with the corresponding comment
		item.populate('comment_id', function(err, item){
			if(err)return res.send({feedback: 'Failure'});
			res.send({feedback: 'Success', comments: item.comment_id.comments});
		});
	})
})
// create comments
app.post('/items/:iid/comments', function(req, res){
	if(!check_login(req, res))return;
	var iid = req.params.iid;
	var content = req.body.content;
	var uid = req.session.uid;
	model.User.get(uid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var user = result.user;
		//post a comment
		user.comment({iid: iid, content: content}, function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			return res.send({feedback: 'Success', comments: result.comment.comments});
		})
	})
});
// Item create
app.post('/items/create', function(req, res){
	if(!check_login(req, res))return;
	var info = req.body;
	//get item info from the body of request
	try{
		info.tags = JSON.parse(info.tags);
		info.attributes = JSON.parse(info.attributes);
		info.price = parseFloat(info.price);
		info.quantity = parseInt(info.quantity);
	}catch(err){
		return res.send({feedback: 'Failure'});
	}
	model.User.get(req.session.uid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var user = result.user;
		user.create_item(info, function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			return res.send(result);
		})
	})
})
//get item details
app.get('/items/:iid', function(req, res){
	var iid = req.params.iid;
	//check whether the item exists
	model.Item.get(iid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var item = result.item;
		//replace the comment_id with the according comment
		item.populate('comment_id').populate('cid', function(err, item){
			if(err)return res.send({feedback: 'Failure'});
			var item = item.toObject();
			try{
				delete item.__v;
				delete item.cid.__v;
				delete item.cid.attributes;
				delete item.comment_id.__v;
				delete item.comment_id.iid;
			}catch(e){
				return res.send({feedback: 'Failure'});
			}
			return res.send({feedback: 'Success', item: item});
		})
	})
})
//update item info
app.put('/items/:iid', function(req, res){
	if(!check_login(req, res))return;
	var iid=req.params.iid;
	var info=req.body;
	//get item info from request body
	try{
		info.tags = JSON.parse(info.tags);
		info.attributes = JSON.parse(info.attributes);
		info.price = parseFloat(info.price);
		info.quantity = parseInt(info.quantity);
	}catch(err){
		return res.send({feedback: 'Failure'});
	}
	//check whether the item exists
	model.Item.get(iid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var item=result.item;
		//check owner of the item
		if(item.uid != req.session.uid)return res.send({feedback: 'Failure'});
		item.update_info(info, function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			res.send(result);
		})
	})
})
//delete item
app.delete('/items/:iid', function(req, res){
	if(!check_login(req, res))return;
	var iid=req.params.iid;
	//check whether the item exists
	model.Item.get(iid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var item=result.item;
		//check owner of the item
		if(item.uid != req.session.uid) return res.send({feedback: 'Failure'});
		item.delete_(function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			res.send(result);
		})
	})
})

//get contacts of this user
app.get('/users/contacts', function(req, res){
	if(!check_login(req, res))return;
	var uid=req.session.uid;
	model.Message.find({ $or: [{uid1:uid}, {uid2:uid} ] }, function(err,messages){
		err_msg= 'Fail to get items of this user.'
		if(err){
			//may change err_msg
			return res.send({feedback: 'Failure', err_msg: err_msg});
		}
		var contacts=[];
		messages.forEach(function(message){
			if(message.uid1==uid){
				contacts.push(message.uid2);
			}
			else{
				contacts.push(message.uid1);
			}
		})
		return res.send({feedback: 'Success', contacts: contacts});
	})
})


//get another user's info
app.get('/users/:uid', function(req, res, next){
	var uid = req.params.uid;
	if(!db.Types.ObjectId.isValid(uid) || uid == 'new_messages')return next();
	if(!check_login(req, res))return;
	model.User.findById(uid, '_id username email profile', function(err, user){
		if(err)return res.send({feedback: 'Failure', err_msg: 'Invalid information'});
		return res.send({feedback: 'Success',user:user});
	});
})
//get self info
app.get('/users/self', function(req, res){
	if(!check_login(req, res))return;
	var uid = req.session.uid;
	model.User.findById(uid, '_id username email profile msg_buf history', function(err, user){
		if(err){
			req.session.destroy();
			return res.send({feedback: 'Failure', err_msg: 'Invalid information'});
		}
		return res.send({feedback: 'Success',user:user});
	})
})
//update user info
app.put('/users/update', function(req, res){
	if(!check_login(req, res))return;
	var uid = req.session.uid;
	//check user existence
	model.User.get(uid, function(result){
		if(result.feedback != 'Success')return res.send(result);
		var user = result.user;
		//get profile attributes
		var keys = Object.keys(user.profile.toObject());
		var info = {};
		for(var i=0; i<keys.length; i++){
			var key = keys[i];
			if(req.body[key])info[key] = req.body[key];
			else info[key] = '';
		}
		//update
		user.update_profile(info, function(result){
			if(result.feedback != 'Success')return res.send(result);
			var user = result.user.toObject();
			delete user['password'];
			delete user['__v'];
			return res.send({feedback: 'Success', user: user});
		});
	})
})
//get items of me
app.get('/users/self/items',function(req, res){
	if(!check_login(req, res))return;
	var uid=req.session.uid;
	//replace cid by the corresponding category
	model.Item.find({uid:uid}).populate('cid').exec(function(err,items){
		err_msg= 'Fail to get items of this user.'
		if(err){
			//may change err_msg
			return res.send({feedback: 'Failure', err_msg: err_msg});
		}
		return res.send({feedback: 'Success', items: items});
	})
})

//get items of a user
app.get('/users/:uid/items',function(req, res){
	if(!check_login(req, res))return;
	var uid=req.params.uid;
	model.Item.find({uid:uid}).populate('cid').exec(function(err,items){
		err_msg= 'Fail to get items of this user.'
		if(err){
			//may change err_msg
			return res.send({feedback: 'Failure', err_msg: err_msg});
		}
		return res.send({feedback: 'Success', items: items});
	})
})

//Get category list
app.get('/categories',function(req,res){
	model.Category.find({}, function(err,categories){
		err_msg= 'Fail to get category list.';
		if(err){
			//may change err_msg

			return res.send({feedback: 'Failure', err_msg: err_msg});
		}
		if(!categories){
			err_msg= 'No category returned.';
			return res.send({feedback: 'Failure', err_msg: err_msg});
		}
		return res.send({feedback: 'Success', categories: categories});
	})
})
//Get items under a category
app.get('/categories/:cid/items',function(req,res){
	var cid=req.params.cid;
	//check existence of the category
	model.Category.get(cid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var category=result.category;
		category.get_items(function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			res.send(result);
		})
	})
})

//Message resource need modify
//send message
app.post('/messages/:uid', function(req, res){
	if(!check_login(req, res))return;
	var info = {};
	info.content = req.body.content;
	info.uid = req.params.uid;
	var uid2=req.session.uid;
	//check existence of the receiver
	model.User.get(uid2, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var user=result.user;
		user.send_msg(info,function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			return res.send(result);
		})
	})
})
//check new messages
app.get('/users/new_messages', function(req, res){
	if(!check_login(req, res))return;
	var uid=req.session.uid;
	model.User.get(uid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var msg_buf=result.user.msg_buf;
		var user = result.user;
		user.msg_buf = [];
		user.save();
		return res.send({feedback: 'Success', msg_buf:msg_buf})
	})
})
//receive messages
app.get('/messages/:uid', function(req, res){
	if(!check_login(req, res))return;
	var uid=req.params.uid;
	var uid2=req.session.uid;
	model.User.get(uid2, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var user=result.user;
		user.recv_msg(uid, function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			res.send(result);
		})
	})
})

//Follow resource
//follow
app.get('/follow/:uid',function(req, res, next){
	var uid = req.params.uid;
	if(!db.Types.ObjectId.isValid(uid) || uid == 'followers' || uid == 'followees')return next();
	if(!check_login(req, res))return;
	var followee_uid=req.params.uid;
	var follower_uid=req.session.uid;
	//check followee existence
	model.User.get(follower_uid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var user=result.user;
		user.follow(followee_uid,function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			res.send(result);
		})
	})
})
//unfollow
app.get('/unfollow/:uid',function(req, res){
	if(!check_login(req, res))return;
	var followee_uid=req.params.uid;
	var follower_uid=req.session.uid;
	//check follower existence
	model.User.get(follower_uid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var user=result.user;
		user.unfollow(followee_uid,function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			res.send(result);
		})
	})
})

//list followees
app.get('/follow/followees', function(req, res){
	if(!check_login(req, res))return;
	var uid=req.session.uid;
	model.Follow.find({follower_id:uid},function(err, follows){
		err_msg='Fail to find followees.';
		if(err){
			//may change err_msg
			return res.send({feedback: 'Failure', err_msg: err_msg});
		}
		var followees=[];
		follows.forEach(function(follow){
			followees.push(follow.followee_id);
		})
		return res.send({feedback: 'Success', followees: followees})
	})
})
//list followers
app.get('/follow/followers', function(req, res){
	if(!check_login(req, res))return;
	var uid=req.session.uid;
	model.Follow.find({followee_id:uid},function(err, follows){
		err_msg='Fail to find followers.';
		if(err){
			//may change err_msg
			return res.send({feedback: 'Failure', err_msg: err_msg});
		}
		var followers=[];
		follows.forEach(function(follow){
			followers.push(follow.follower_id);
		})
		return res.send({feedback: 'Success', followers: followers})
	})
})

//Transaction resource
//get transaction detail by tid
app.get('/transactions/:tid', function(req, res, next){
	var tid = req.params.tid;
	if(!db.Types.ObjectId.isValid(tid))return next();
	if(!check_login(req, res))return;
	var uid = req.session.uid;
	model.Transaction.get(tid, function(result){
		if(result.feedback != 'Success')return res.send(result);
		var transaction = result.transaction;
		//check transaction owner
		if(transaction.seller_id != uid && transaction.buyer_id != uid)return res.send({feedback: 'Failure', err_msg: 'Invalid user'});
		return res.send({feedback: 'Success', transaction: transaction});
	})
})
//buy request
app.post('/transactions/create', function(req, res){
	if(!check_login(req, res))return;
	var info=req.body;
	var iid=info.iid;
	var uid=req.session.uid;
	model.Item.get(iid, function(result){//check whether quantity is 0 or not
		if(result.feedback != 'Success')return res.send({feedback: 'Failure',err_msg:'Cannot find this item.'});
		var item=result.item;
		//check quantity
		if (item.quantity <= 0) return res.send({feedback: 'Failure',err_msg:'No inventory.'});
		model.User.get(uid, function(result){
			var user=result.user;
			user.buy_request(iid, function(result){
				if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
				res.send(result);
			})
		})
	})
})
//sell confirm
app.get('/transactions/:tid/confirm', function(req, res){
	if(!check_login(req, res))return;
	var tid=req.params.tid;
	var uid=req.session.uid;
	model.Transaction.get(tid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure',err_msg:'Cannot find this transaction.'});
		var iid=result.transaction.iid;
		model.Item.get(iid, function(result){
			if(result.feedback != 'Success') return res.send({feedback: 'Failure',err_msg:'Cannot find the item.'});
			var item=result.item;
			//check whether quantity is 0 or not
			if (item.quantity <= 0) return res.send({feedback: 'Failure',err_msg:'No inventory.'});
			//check owner
			if(item.uid != req.session.uid)return res.send({feedback: 'Failure'});
			var new_info={};
			new_info.quantity=item.quantity-1;

			model.User.get(uid, function(result){
				if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
				var user=result.user;
				user.sell_confirm(tid, function(result){
					if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
					//update item info (quantity)
					item.update_info(new_info, function(result){
						if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
						model.Category.get(item.cid, function(result){
							if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
							var category=result.category;
							category.update_sold(function(result){
								if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
								return res.send(result);
							})
						})
					})
				})
			})
		})
	})
})
//receive confirm
app.get('/transactions/:tid/receive', function(req, res){
	if(!check_login(req, res))return;
	var tid=req.params.tid;
	var uid=req.session.uid;
	model.User.get(uid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var user=result.user;
		user.receive_confirm(tid, function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			res.send(result);
		})
	})
})
//seller reject
app.get('/transactions/:tid/reject', function(req, res){
	if(!check_login(req, res))return;
	var tid=req.params.tid;
	var uid=req.session.uid;
	model.Transaction.get(tid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure',err_msg:'Cannot find this transaction.'});
		var iid=result.transaction.iid;
		model.Item.get(iid, function(result){
			if(result.feedback != 'Success') return res.send({feedback: 'Failure',err_msg:'Cannot find the item.'});
			var item=result.item;
			//check owner
			if(item.uid != req.session.uid)return res.send({feedback: 'Failure'});
			model.User.get(uid, function(result){
				if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
				var user=result.user;
				user.seller_reject(tid, function(result){
					if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
					res.send(result);
				})
			})
		})
	})
})
//buyer cancel
app.get('/transactions/:tid/cancel', function(req, res){
	if(!check_login(req, res))return;
	var tid=req.params.tid;
	var uid=req.session.uid;
	model.User.get(uid, function(result){
		if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
		var user=result.user;
		user.buyer_cancel(tid, function(result){
			if(result.feedback != 'Success')return res.send({feedback: 'Failure'});
			res.send(result);
		})
	})
})

//search by keyword, price range, category and tags
app.get('/search', function(req, res){//search is not in order
	var keyword=req.query.keyword;
	var min_price=req.query.minprice;
	var max_price=req.query.maxprice;
	var cid=req.query.cid;
	var tags = req.query.tags;
	var page = req.query.page;
	var items=[];
	var condition = {quantity: {$gt: 0}};
	if(typeof(keyword) != 'undefined'){
		condition.$or = [];
		condition.$or.push({'attributes.title': new RegExp(keyword, 'i')});
		condition.$or.push({'attributes.description': new RegExp(keyword, 'i')});
	}
	if(typeof(min_price) != 'undefined'){
		condition.price = {};
		condition.price.$gte = min_price;
	}
	if(typeof(max_price) != 'undefined'){
		if(!('price' in condition))condition.price = {};
		condition.price.$lte = max_price;
	}
	if(typeof(cid) != 'undefined' && db.Types.ObjectId.isValid(cid)){
		condition.cid = cid;
	}
	if(typeof(tags) != 'undefined'){
		try{
			tags = JSON.parse(tags);
			var search_cmp = function(a, b){
				var aa = (tags.indexOf(a))?1:0;
				var bb = (tags.indexOf(b))?1:0;
				return aa-bb;
			}
		}catch(e){
			return res.send({feedback: 'Failure'});
		}
	}
	if(typeof(page) == 'undefined')page = 0;
	else{
		try{
			page = parseInt(page);
		}catch(e){
			res.send({feedback: 'Failure'});
		}
	}
	//replace cid by category
	model.Item.find(condition).populate('cid').exec(function(err, items){
		if(err)return res.send({feedback: 'Failure'});
		var count = items.length;
		var page_size = app.get('search_page_size');
		if(typeof(keyword) != 'undefined'){
			var items1 = [];
			var items2 = [];
			var keyword_reg = new RegExp(keyword, 'i');
			items.forEach(function(item){
				if(item.attributes.title.match(keyword_reg))return items1.push(item);
				else return items2.push(item);
			})
			items1 = items1.sort(search_cmp);
			items2 = items2.sort(search_cmp);
			items = items1.concat(items2);
		}else{
			items = items.sort(search_cmp);
		}
		//slice the result into pages
		items = items.slice(page*page_size, (page+1)*page_size);
		return res.send({feedback: 'Success', count: count, items: items});
	});
})

//recommend based on the popularity of category
app.get('/recommends', function(req, res){
	Category.findOne().sort('-sold').exec(function(err, category){
		if(err)return res.send({feedback: 'Failure'});
		Item.find({cid: category._id}).limit(app.get('recommend_size')).populate('cid').exec(function(err, items){
			if(err)return res.send({feedback: 'Failure'});
			return res.send({feedback: 'Success', items: items});
		});
	})
})

//buyer name, sell name, item name
app.get('/users/self/transactions', function(req, res){
	if(!check_login(req, res))return;
	model.User.findById(req.session.uid, function(err, user){
		var history = user.history;
		var i = 0;
		var trans_new = [];
		async.whilst(function(){
			return i < history.length;
		},
		function(next){
			var tid = history[i];
			model.Transaction.findById(tid).populate('iid', '_id attributes.title').populate('seller_id', '_id username').populate('buyer_id', '_id username').exec(function(err, transaction){
				trans_new.push(transaction);
				i += 1;
				next();
			})
		},
		function(err){
			res.send(trans_new);
		});
	})
})

//debug test, for testing only, should be removed when the website goes online
//for convenience, no error handling here
/*app.get('/showdbs', function(req,res){
	var dbs={}
	model.User.find({}, function(err ,users){
		dbs.users=users;
		model.Item.find({}).populate('cid').exec(function(err ,items){
			dbs.items=items;
			model.Category.find({}, function(err ,categories){
				dbs.categories=categories;
				model.Follow.find({}, function(err ,follows){
					dbs.follows=follows;
					model.Message.find({}, function(err ,messages){
						dbs.messages=messages;
						model.Transaction.find({}, function(err ,transactions){
							dbs.transactions=transactions;
							return res.send('<pre>'+JSON.stringify(dbs, null, 4)+'</pre>');
						})
					})
				})
			})
		})
	})
})*/
