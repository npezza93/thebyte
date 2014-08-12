jQuery ->
	$('#avatar_upload_link').click ->
		$('#avatar_upload_field').click()

	$('#avatar_upload_field').change ->
		$('#profile_pic_submit').click()

	$('#usernames').click ->
		$('#overlay2').toggle()

	$('#logout_button').click ->
		$('#logout_button_invis').click()

	$('#paper_admin_toggle').change ->
		if $('#invisible_admin_toggle').is ':checked'
			$('#invisible_admin_toggle').prop('checked', false)
		else
			$('#invisible_admin_toggle').prop('checked', true)

	$("#new_user_button").click ->
		document.location='/users/new'

	$("#user_back_button").click ->
		document.location ='/users'

	$("#manage_button_1").click ->
		document.location ='/users'

	$("#manage_button_2").click ->
		document.location ='/inactive_posts'