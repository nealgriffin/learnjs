'use strict';

var learnjs = {};

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
learnjs.landingView = function() {
	return learnjs.template('landing-view');
}

learnjs.problemView = function(data) {
	var problemNumber = parseInt(data, 10)
	var view = $('.templates .problem-view').clone();
	var problemData = learnjs.problems[problemNumber -1];

	var resultFlash = view.find('.result');

	function check_answer() {
		var answer = view.find('.answer').val();
		var test = problemData.code.replace('__', answer) + '; problem();'
		return eval(test);
	}
	function check_answer_click() {
		if (check_answer()) {
			var correctFlash = learnjs.template('correct-flash');
			correctFlash.find('a').attr('href', '#problem-' + (problemNumber + 1));
			learnjs.flashElement(resultFlash, correctFlash);
		} else {
		  learnjs.flashElement(resultFlash, 'Incorrect!');
		}
		return false;
	}
	view.find('.check-btn').click(check_answer_click);

	view.find('.title').text('Problem #' + problemNumber + ' Coming Soon!');
	learnjs.applyObject(problemData, view);
	var buttonItem = learnjs.template('skip-btn');
	buttonItem.find('a').attr('href', '#problem-' + (problemNumber-1));
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

learnjs.showView = function(hash) {
	var routes = {
		'#problem': learnjs.problemView,
		''        : learnjs.landingView,
		'#'       : learnjs.landingView
	};
	var hashParts = hash.split('-');
	var viewFn = routes[hashParts[0]];


	if (viewFn) {
		learnjs.triggerEvent('removingView', []);
		$('.view-container').empty().append(viewFn(hashParts[1]));
	}
	
}

learnjs.appOnReady = function() {
	window.onhashchange = function() {
		learnjs.showView(window.location.hash);
	}
	learnjs.showView(window.location.hash);
	//console.log("The document has loaded!");
}