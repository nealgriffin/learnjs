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
	//console.log("before sending req");
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

learnjs.call_echo = function() {
	return learnjs.identity.then(function(id) {

		var lambda = new AWS.Lambda();
		var params = {
			FunctionName: 'subscriber_authorization',
			Payload: JSON.stringify({"TestKey1": "TestValue"})
		};
		return learnjs.sendDbRequest(lambda.invoke(params), function() {
			return learnjs.call_echo();
		});
	//lambda.invoke(params);

	});
	////////// the above was the async call, switch this to be a synchronous call.

	/// First lets clarify the issue - when we refresh the page - we essentially reload the entire app - that
	/// clears out the AWS.config.credentials object - which then needs to be repopulated - which will happen,
	/// but only if the user is already signed in ... so we should only 
}

/* 
Ok - so you've almost figured this out after viewing the home page, when signed in - the very next view still 
has the AWS.config.credentials. It is very unclear why AWS.config.credentials is null the second when the page
is refreshed.

So, it seems like on the second time, awsRefresh isn't gettting called until after the code to render the page
has been called. Hmmmm - so this looks like it is an issue of the full page refresh - the full page refresh is
then wiping out all of AWS.config - which then only get repopulated after the render calls on account of
'async defer' attached to the googleSignIn snipit.

so - to fix this, on a full page refresh - we need a way to populate AWS.config. We can't check AWS.config 
and then execute. What we need to do is determine whether or not the user is signed in.

Well - when we execute learnjs.identity.then() - this will determine if we are signed in or not.

So - we arrive at the site, not signed in - we click on /#subcribers, the page loads
Step 1. call learnjs.identity.done() - think of this as, once the identity is resolved ... do something.


So - now my problem is that I am immediately returning the view - however - the call_echo() asynchronous
request hasn't resolved by the time I am rendering this. Hmmm - I could create a new promise...


NEW THINKING - .... lets not make call_echo() an async request - lets make it blocking.




*/
learnjs.do_echo = function() {
	AWS.config.update({
		region: 'us-east-1',
		credentials: new AWS.CognitoIdentityCredentials({
			IdentityPoolId: learnjs.poolId
		})
	});
	console.log("have you even been executed!");
	var lambda = new AWS.Lambda();
	var params = {
		FunctionName: 'echo',
		Payload: JSON.stringify({"TestKey1": "TestValue"})
	};
	//return learnjs.sendDbRequest(lambda.invoke(params), function() {
	//	return learnjs.call_echo();
	//});
	lambda.invoke(params, function(error) {
		if (error) { console.log(error) };
	});

}


learnjs.landingView = function() {
	return learnjs.template('landing-view');
}

learnjs.problemView = function(data) {
	var problemNumber = parseInt(data, 10)
	var view = $('.templates .problem-view').clone();
	var lambdaAnswer = view.find('.dinosaur');
	var problemData = learnjs.problems[problemNumber -1];
	var answer = view.find('.answer');
	var resultFlash = view.find('.result');

	learnjs.fetchAnswer(problemNumber).then(function(data) {
		if (data.Item) {
			answer.val(data.Item.answer);
		};
	});

	learnjs.call_echo().then(function(data) {
		if (data.Payload) {
			lambdaAnswer.text(data.Payload);
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
		'#problem'    : learnjs.problemView,
		'#profile'    : learnjs.profileView,
		''            : learnjs.landingView,
		'#'           : learnjs.landingView,
		'#reg'        : learnjs.registrationView,
		'#subscriber' : learnjs.subscriptionContent

	};
	var before_filter = ['#subscriber'];
	var hashParts = hash.split('-');
	var viewFn = routes[hashParts[0]];

	if (viewFn) {
		learnjs.triggerEvent('removingView', []); //any existing views receive this message


		/*
			Ok - here you are - you are calling the gapi to figure out if you are logged in or not,
			if you are signedIn - it renders the view - if not, it drops back out to the landing view.
			This doesn't seem like the best idea. It would be better if you tried to call the Lambda
			service directly here because 1.) this code is dependent on utilizing the gapi signin.
			For example, what would happen if you are using Facebook or a different sign-in method.

			NEXT THOUGHT - maybe creaete a listig of 'protected' views for which the user must be signed 
			in inorder to view - then, if the requested function

		*/

		//Step 1. check if the route is part of a before_filter

		if ( before_filter.indexOf(hashParts[0]) > -1 ) {
			// Step 2. The route is part of a before filter - check to see if localStorage has an Identity
			// if no identity exist - then redirect the user to the login page or to the home page
			console.log(localStorage.hasOwnProperty('aws.cognito.identity-id.' + learnjs.poolId));
			// Step 3. If an identity exists - you are good to go to render the page - the HTML will show up
			// followed shortly by any protected content.

			// Step 3a. once the Lambda function is called, you may then determine that the user has not 
			// yet purchased the application. You could call the Lambda service here to see if they are
			// authorized, and if so, pass in the information to the view ... or

			// Step 3b. for users who are signed in, but not yet authorized, meaning they haven't yet purchased
			// the subscription - maybe return a limited view of the video - that you record separately - so that,
			// as long as someone is signed_in() they will always receive some content. This would require A LOT 
			// more work as each video would then require

		}
		// gapi.load('auth2', function() {
		// 	gapi.auth2.init().then(function(googleAuth) {
		// 		if (googleAuth.isSignedIn.get() ) {
		// 			//console.log("signed in");
		// 			learnjs.identity.then(function() {
		// 				//console.log("learnjs.identity resolved");
		// 			});
		// 			$('.view-container').empty().append(viewFn(hashParts[1]));
		// 		} else {
		// 			//console.log("not signed in");
		// 			learnjs.identity.then(function() {
		// 				//console.log("learnjs.identity resolved");
		// 			});
		// 			$('.view-container').empty().append(learnjs.landingView());
		// 		}
		// 	});
		// });
		
		 //then render the view
		// in this case, on the problemView has bound and event listener to remove the skip
		// button.
		$('.view-container').empty().append(viewFn(hashParts[1]));
		
	}	
}

learnjs.subscriptionContent = function() {
	//console.log("subscriber called");
	var view = learnjs.template('subscription-content').clone();

	learnjs.call_echo()
		.done(function(data) {
			console.log("The call_echo Promise resolved successfully. " + data.Payload);
			view.find('#specific-content').text(data.Payload);
		})
		.fail(function(data) {
			console.log("That sucks - it failed. " + data);
			//view = '';
		});
	return view;
}

learnjs.registrationView = function() {

	var view = learnjs.template('registrations-view');
	
	function submit_registration() {
		//console.log("this fargin button was clicked");
		// easy - in here submit the call to do_echo & you are finished!
		// AWS.config.update({
		// 	region: 'us-east-1',
		// 	credentials: new AWS.CognitoIdentityCredentials({
		// 		IdentityPoolId: learnjs.poolId
		// 	})
		// });
		var lambda = new AWS.Lambda();
		var family_name = view.find('#family').val();
		var email = view.find('#email').val();
		var children = view.find('#children').val();
		var adults = view.find('#adults').val();
		var event_id = view.find('#event_id').val();
		//var cognito_id = learnjs.identity.done(function(identity){return identity.id});

		var params = {
			FunctionName: 'echo',
			Payload: JSON.stringify({
				"family_name": family_name,
				"email": email,
				"children": children,
				"adults": adults,
				"event_id": event_id,
				"cognito_id": 'why'
			})
		}
		console.log(params);
		// lambda.invoke(params, function(error, data) {
		// 	if (error) { console.log(error) };
		// });
		return learnjs.sendDbRequest(lambda.invoke(params), function(err) {
			console.log(err);
		});
		return false;
	}
	view.find('#event_id').val("2016-01")
	view.find('.submit-btn').click(submit_registration);
	var options = {
		method: "GET",
		url: "https://ubf4tzaxdk.execute-api.us-east-1.amazonaws.com/stage/pets",
		params: {
			"page": 2,
			"type": "Dog"
		},
		headers: {
			"Authorization": "allow"
		}
	}
	learnjs.makeRequest( options )
		.then(function(resp) {
			console.log(resp);
		})
		.catch(function(resp) {
			console.log(resp);
		});
	return view;
}

learnjs.awsRefresh = function() {
	var deferred = new $.Deferred();
	//console.log("awsRefresh was called");
	AWS.config.credentials.refresh(function(err) {
		if (err) {
			deferred.reject(err);
		} else {
			deferred.resolve(AWS.config.credentials.identityId);
		}
	});
	return deferred.promise();
}
learnjs.navigation = function() {
	$('.js-toggleMenu').click(function() {
		if( $('.menuSidebar').hasClass('isOpen') ) {
			$('.menuSidebar').removeClass('isOpen');
			$('body').removeClass('menuIsOpen');
		} else {
			$('.menuSidebar').addClass('isOpen');
			$('body').addClass('menuIsOpen');
		}
	});
}

learnjs.appOnReady = function() {
	//console.log("I was called first");


	window.onhashchange = function() {
		learnjs.showView(window.location.hash);
	}
	learnjs.showView(window.location.hash);
	//learnjs.identity.done(learnjs.addProfileLink);
	learnjs.navigation();
	


	//console.log("The document has loaded!");
	//learnjs.do_echo();
	//learnjs.identity.done(learnjs.test_function);
}

learnjs.signout = function() {
	var creds = new AWS.CognitoIdentityCredentials({IdentityPoolId: learnjs.poolId});
	creds.clearCachedId();
}

function googleSignIn(googleUser) {
	//console.log(arguments);
	//console.log("Google signIn was called");
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
		//console.log("this was called within googleSignIn");
		learnjs.identity.resolve({
			id: id,
			email: googleUser.getBasicProfile().getEmail(),
			refresh: refresh
		});
	});
}
learnjs.test_function = function(arg) {
	console.log(arg);
}

learnjs.makeRequest = function( opts ) {
	return new Promise( function(resolve, reject) {
		var xhr = new XMLHttpRequest();
		var params = opts.params;
		if (params && typeof params === 'object') {
			params = Object.keys(params).map(function(key) {
				return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
			}).join('&');
		}
		opts.url = opts.url + "?" + params
		xhr.open(opts.method, opts.url);
		xhr.onload = function() {
			if (this.status >= 200 && this.status < 300) {
				resolve(xhr.response);
			} else {
				reject({
					status: this.status,
					statusText: xhr.statusText
				})
			}
		};

		xhr.onerror = function() {
			reject({
				status: this.status,
				statusText: xhr.statusText
			})
		};
		if (opts.headers) {
			Object.keys(opts.headers).forEach(function(key) {
				xhr.setRequestHeader(key, opts.headers[key]);
			});
		}
		
		xhr.send(params);
	});
};













