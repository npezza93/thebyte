jQuery ->
	$('#submit_comment').click ->
    	$('#submit_comment_invis').click()
  
	$('#show_post_delete').click ->
    	$('#delete_post_invis').click()

	$('#usernames').click ->
		$('#overlay2').toggle()

	$('#post_title_input').change ->
  		$('#post_title_input_invis').val($('#post_title_input').val());

 	$('#create_post_button').click ->
  		$('#create_post_button_invis').click()

	$('#post_title_input').attr("value",$('#post_title_input_invis').val());

	$('#login_button').click ->
		document.getElementById("overlay").toggle();
		document.getElementById("baluga").selected = 0;
		document.getElementById("paper_tabs").selected =0;
	
	$("#signup_button").click ->
		document.getElementById("overlay").toggle();
		document.getElementById("baluga").selected = 1;
		document.getElementById("paper_tabs").selected =1;

	$('#logout_button').click ->
  		$('#logout_button_invis').click()

  	$('#paper_tabs').click ->
  		$("#baluga").prop("selected", $("#paper_tabs").prop("selected"))

  	$("#forgot_password").click ->
  		document.getElementById('overlay3').toggle()

  	$("#new_post_button").click ->
  		document.location='/posts/new'
  	
  	$("#about_facebook").click ->
  		document.location='https://www.facebook.com/pages/While-True/546036762189676'
		return false;

