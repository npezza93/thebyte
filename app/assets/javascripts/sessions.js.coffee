# Place all the behaviors and hooks related to the matching controller here.
# All this logic will automatically be available in application.js.
# You can use CoffeeScript in this file: http://coffeescript.org/

jQuery ->
	$("#forgot_password").click ->
		$("#forgot-dialog")[0].toggle()
		return

	$("#one").click (e) ->
		if $("#paperTabs")[0].selected != "0"
			$("#baluga")[0].selected = 0
			$("#baluga").attr 'entry-animation', 'slide-from-right-animation'
			$("#baluga").attr 'exit-animation', 'slide-left-animation'
		return

	$("#two").click (e) ->
		$("#baluga")[0].selected = 1
		$("#baluga").attr 'entry-animation', 'slide-from-left-animation'
		$("#baluga").attr 'exit-animation', 'slide-right-animation'
		return