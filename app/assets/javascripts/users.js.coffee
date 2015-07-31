jQuery ->
	$("#cancel-form").click ->
		window.history.back()
		return 

	$(".back-button").click ->
		document.location.href = '/'
		return 
		
	$('#avatar_upload_link').click ->
		$("#avatar_upload_field").click()
		return

	$('#avatar_upload_field').change ->
		$('.edit_user').submit()
		return

	$('#usernames').click ->
		$('#overlay2').toggle()
		return

	$('#paper_admin_toggle').change ->
		if $('#invisible_admin_toggle').is ':checked'
			$('#invisible_admin_toggle').prop('checked', false)
		else
			$('#invisible_admin_toggle').prop('checked', true)

	$("#user_back_button").click ->
		document.location ='/users'

	$("body").on "click", "#manage_button_1", ->
		document.location = '/users'
		return

	$("body").on "click", "#edit_user_button", ->
		document.location = 'users/' + $("#edit_user_button")[0].classList[0] + '/edit'
		return

	$('body').on {
		mouseenter: ->
			$("#avatar-overaly-text").fadeIn()
			return
		mouseleave: ->
			$("#avatar-overaly-text").fadeOut()
			return

	}, '#profile-avatar'

	$(".edit_user_link").on "click", ->
		document.location = 'users/' + $(this)[0].classList[0] + '/edit'
		return

	$(".users-admin-toggle").on "change", ->
		$(this).parent().find('.toggle_user_admin').prop 'checked', !$(this).parent().find('.toggle_user_admin').prop 'checked'
		$(this).parent().submit()
		return

	$(".delete-user-button"). on "click", ->
		$(this).parent().find("a").click()
		return