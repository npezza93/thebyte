# Place all the behaviors and hooks related to the matching controller here.
# All this logic will automatically be available in application.js.
# You can use CoffeeScript in this file: http://coffeescript.org/

jQuery ->
	$('#usernames').click ->
  		document.getElementById('overlay2').toggle();

	$('#logout_button').click ->
		$('#logout_button_invis').click()