scrollpos =0
flag = 0
$(window).load ->
	twttr.widgets.load()
	if $("#page-notice-toast").length > 0
		$('#page-notice-toast')[0].toggle()
	if document.location.pathname.split("/")[2] == "new" || document.location.pathname.split("/")[3] == "edit"
		$($(".froala-box").children()[1]).attr("hidden", "")
		$("div.froala-wrapper.f-basic").removeAttr("hidden")
	$('img.fr-fin').captionjs
		'mode': 'stacked'
		'is_responsive': true
	$('.grid').masonry
		itemSelector: '.grid-item'
		gutter: 12
	$('.new-comment').editable
		theme: "dark"
		inlineMode: false
		spellcheck: true
		countCharacters: false
		mediaManager: false
		buttons: ['bold', 'italic', 'underline', 'strikeThrough', 'sep', 'color', 'formatBlock', 'insertOrderedList','insertUnorderedList', 'createLink', 'sep','undo','redo']
		blockTags: 
			n: "Normal"
			pre: "Code"
		icons: 
			bold:
				type: 'font'
				value: 'mdi mdi-format-bold'
			italic:
				type: 'font'
				value: 'mdi mdi-format-italic'
			underline:
				type: 'font'
				value: 'mdi mdi-format-underline'
			strikeThrough:
				type: 'font'
				value: 'mdi mdi-format-strikethrough'				
			color:
				type: 'font'
				value: 'mdi mdi-format-paint'
			formatBlock:
				type: 'font'
				value: 'mdi mdi-format-paragraph'
			insertOrderedList:
				type: 'font'
				value: 'mdi mdi-format-list-numbers'
			insertUnorderedList:
				type: 'font'
				value: 'mdi mdi-format-list-bulleted'
			createLink:
				type: 'font'
				value: 'mdi mdi-link'				
			insertImage:
				type: 'font'
				value: 'mdi mdi-file-image-box'
			undo:
				type: 'font'
				value: 'mdi mdi-undo'
			redo:
				type: 'font'
				value: 'mdi mdi-redo'


	$(".froala-box").each ->
		$($(this).children()[2]).attr("hidden", "")

	if document.location.pathname == "/" or document.location.pathname == "/posts"
		page('/', index)
		page '/posts', ->
			page.redirect('/')
		page('/:id', post)
		page({ hashbang: true})

	setTimeout (->
		if $('home-toolbar').length > 0
			$('.grid').masonry
				itemSelector: '.grid-item'
				gutter: 12
			$('home-toolbar')[0].show()
			$("animated-grid")[0].show()
			$('about-section')[0].show()
		return
	), 400
	flag = 1
	return

index = ->
	$('#new-post-fab').fadeIn()
	if flag == 1
		$('home-toolbar')[0].show()
		$('about-section')[0].show()

	$("#posts_pagination").fadeIn()
	if $('neon-animated-pages')[1]
		$('neon-animated-pages')[1].selected = 0
	window.scrollTo(0, scrollpos)
	document.title = 'While True'
	$("body")[0].style.overflowY = ""
	$('.grid').masonry
		itemSelector: '.grid-item'
		gutter: 12

	return

post = (id) ->
	$("body")[0].style.overflowY = "hidden"
	scrollpos = document.body.scrollTop
	if flag == 1
		$('home-toolbar')[0].dontshow()
		$('about-section')[0].dontshow()
		$("#new-post-fab").fadeOut()

	fullPage = $("neon-animated-pages").find("#" + id.params.id)[0]
	selected = $("show-post").index(fullPage)
	document.title = fullPage.childNodes[3].childNodes[3].childNodes[1].childNodes[4].childNodes[1].childNodes[1].textContent
	$('neon-animated-pages')[1].selected = selected + 1	
	$("animated-grid")[0].showPost(id.params.id)
	return

jQuery ->
	$(window).resize ->
		$('.grid').masonry
			itemSelector: '.grid-item'
			gutter: 12
		return

	$('#new-post-fab').click ->
		document.location = '/posts/new'
		return

	$('body').on 'click', '#usernames', ->
		$('#overlay2')[0].toggle()
		return

	$('body').on 'click', "#show_post_edit", ->
		document.location = document.location.pathname + '/edit'
		return

	$("#home_page_back").on 'click', ->
		document.location = '/'
		return

	$('body').on 'click', "#show_post_delete", ->
		$(this).parent().find('a').click()
		return

	$('body').on 'click', "#home_post_edit", ->
		document.location = '/posts/' + $(this)[0].getAttribute("slug") + '/edit'
		return

	$('body').on 'click', "#home_post_delete", ->
		$(this).parent().find('a').click()
		return

	$('body').on 'click', ".gshare-button", ->
		window.open($(this).find('div').attr('href'), '_blank', 'height=500,width=550')
		return

	$('body').on 'click', ".fshare-button", ->
		window.open $(this).find('div').attr('href'), '_blank', 'height=500,width=550'
		return

	$("#about_facebook").click ->
		document.location='https://www.facebook.com/pages/While-True/546036762189676'
		return

	$('body').on 'click', '#signup_button', ->
		$("#paperTabs")[0].selected = 1
		$("#baluga")[0].selected = 1
		$("#new_session_overlay")[0].toggle()
		$("#baluga").attr 'entry-animation', 'slide-from-left-animation'
		$("#baluga").attr 'exit-animation', 'slide-right-animation'
		return

	$('body').on 'click', '#login_button', ->
		$("#paperTabs")[0].selected = 0
		$("#baluga")[0].selected = 0
		$("#new_session_overlay")[0].toggle()
		$("#baluga").attr 'entry-animation', 'slide-from-right-animation'
		$("#baluga").attr 'exit-animation', 'slide-left-animation'
		return

	$('body').on 'click', '.next', ->
		page.stop()
		$(this).find("a").click()
		return

	$('body').on 'click', '.prev', ->
		page.stop()
		$(this).find("a").click()
		return

	$('#about_twitter').click ->
		document.location = 'https://twitter.com/while_true0'
		return
		
	$('#about_gp').click ->
		document.location = 'https://plus.google.com/107587555244815719248'
		return

	if document.location.pathname == "/" or document.location.pathname == "/posts"
		$('template[is="dom-bind"]')[0]._onTileClick = (event) ->
			selectedPost = event.detail.tile.parentNode.parentNode.getAttribute("postslug")
			page('/'+ selectedPost)
			return

		$('template[is="dom-bind"]')[0]._onFullsizeClick = (event) ->
			page("/")			
			return