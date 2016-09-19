'use strict';

var learnjs = {};

learnjs = {
	poolId: "us-east-1:e3cd1d9a-459b-49be-ab67-6516c4d7ab62"
}

learnjs.identity = new $.Deferred();

learnjs.problems = [
	{
		description: "What is truth?",
		code: "function problem() { return __; }"
	},
	{
		description: "Simple math",
		code: "function problem() { return 42 === 6 * __; }"
	}


];
/*

******** Database API *********

*/
learnjs.sendDbRequest = function(req, retry) {
	var promise = new $.Deferred();
	req.on('error', function(error) {
		if (error.code === "CredentialsError") {
			learnjs.identity.then(function(identity) {
				return identity.refresh().then(function() {
					return retry();
				}, function() {
					promise.reject(resp);
				});
			});
		} else {
			promise.reject(error);
		}
	});
	req.on('success', function(resp) {
		promise.resolve(resp.data);
	});
	req.send();
	return promise;
}

learnjs.saveAnswer = function(problemId, answer) {
	return learnjs.identity.then(function(identity) {
		var db = new AWS.DynamoDB.DocumentClient();
		var item = {
			TableName: 'learnjs',
			Item: {
				userId: identity.id,
				problemId: problemId,
				answer: answer
			}
		};
		return learnjs.sendDbRequest(db.put(item), function() {
			return learnjs.saveAnswer(problemId, answer);
		})
	});
};

learnjs.fetchAnswer = function(problemId) {
	return learnjs.identity.then(function(identity) {
		var db = new AWS.DynamoDB.DocumentClient();
		var item = {
			TableName: 'learnjs',
			Key: {
				userId: identity.id,
				problemId: problemId
			}
		};
		return learnjs.sendDbRequest(db.get(item), function(){
			return learnjs.fetchAnswer(problemId);
		})
	});
};

learnjs.landingView = function() {
	return learnjs.template('landing-view');
}

learnjs.problemView = function(data) {
	var problemNumber = parseInt(data, 10)
	var view = $('.templates .problem-view').clone();
	var problemData = learnjs.problems[problemNumber -1];
	var answer = view.find('.answer');
	var resultFlash = view.find('.result');

	learnjs.fetchAnswer(problemNumber).then(function(data) {
		if (data.Item) {
			answer.val(data.Item.answer);
		};
	});

	function check_answer() {
		var test = problemData.code.replace('__', answer.val()) + '; problem();'
		return eval(test);
	}
	function check_answer_click() {
		
		if (check_answer()) {
			var correctFlash = learnjs.template('correct-flash');
			correctFlash.find('a').attr('href', '#problem-' + (problemNumber + 1));
			learnjs.flashElement(resultFlash, correctFlash);
			learnjs.saveAnswer(problemNumber, answer.val() );
		} else {
		  learnjs.flashElement(resultFlash, 'Incorrect!');
		}
		return false;
	}
	view.find('.check-btn').click(check_answer_click);

	view.find('.title').text('Problem #' + problemNumber + ' Coming Soon!');
	learnjs.applyObject(problemData, view);
	var buttonItem = learnjs.template('skip-btn');
	buttonItem.find('a').attr('href', '#problem-' + (problemNumber + 1));
	$('.nav-list').append(buttonItem);
	view.bind('removingView', function(){
		buttonItem.remove();
	});
	return view;
}

learnjs.template = function(name) {
	return $('.templates .' + name).clone();
}

learnjs.triggerEvent = function(name, args) {
	$('.view-container>*').trigger(name, args);
}



learnjs.flashElement = function(elem, content) {
	elem.fadeOut('fast', function() {
		elem.html(content);
		elem.fadeIn();
	});
}

learnjs.applyObject = function(obj, elem) {
	for (var key in obj) {
		elem.find('[data-name="' + key + '"]').text(obj[key]);
	}
};

learnjs.profileView = function() {
	var view = learnjs.template('profile-view');
	learnjs.identity.done(function(identity) {
		view.find('.email').text(identity.email);
	});
	return view;
}

learnjs.addProfileLink = function(profile) {
	var link = learnjs.template('profile-link');
	link.find('a').text(profile.email);
	$('.signin-bar').prepend(link);
}

learnjs.showView = function(hash) {
	var routes = {
		'#problem': learnjs.problemView,
		'#profile': learnjs.profileView,
		''        : learnjs.landingView,
		'#'       : learnjs.landingView

	};
	var hashParts = hash.split('-');
	var viewFn = routes[hashParts[0]];


	if (viewFn) {
		learnjs.triggerEvent('removingView', []); //any existing views receive this message
		$('.view-container').empty().append(viewFn(hashParts[1])); //then render the view
		// in this case, on the problemView has bound and event listener to remove the skip
		// button.
	}	
}

learnjs.awsRefresh = function() {
	var deferred = new $.Deferred();

	AWS.config.credentials.refresh(function(err) {
		if (err) {
			deferred.reject(err);
		} else {
			deferred.resolve(AWS.config.credentials.identityId);
		}
	});
	return deferred.promise();
}

learnjs.appOnReady = function() {
	window.onhashchange = function() {
		learnjs.showView(window.location.hash);
	}
	learnjs.showView(window.location.hash);
	learnjs.identity.done(learnjs.addProfileLink);
	//console.log("The document has loaded!");
}

function googleSignIn(googleUser) {
	//console.log(arguments);
	var id_token = googleUser.getAuthResponse().id_token;
	AWS.config.update({
		region: 'us-east-1',
		credentials: new AWS.CognitoIdentityCredentials({
			IdentityPoolId: learnjs.poolId,
			Logins: {
				'accounts.google.com': id_token
			}
		})
	})
	function refresh() {
		return gapi.auth2.getAuthInstance().signIn({
			prompt: 'login'
			}).then(function(userUpdate) {
			var creds = AWS.config.credentials;
			var newToken = userUpdate.getAuthResponse().id_token;
			creds.params.Logins['accounts.google.com'] = newToken;
			return learnjs.awsRefresh();
		});
	}
	learnjs.awsRefresh().then(function(id) {
		learnjs.identity.resolve({
			id: id,
			email: googleUser.getBasicProfile().getEmail(),
			refresh: refresh
		});
	});
}

