if (!RedactorPlugins) var RedactorPlugins = {};

RedactorPlugins.q = {
	init: function ()
	{
		var qs = [ 'Left Quote', 'Center Quote', 'Right Quote' ];
		var that = this;
		var dropdown = {};

		$.each(qs, function(i, s)
		{
			dropdown['s' + i] = { title: s, callback: function() { that.setq(s); }};
		});

		dropdown['remove'] = { title: 'Remove Quote', callback: function() { that.resetq(); }};

		this.buttonAdd('quote', 'Block Quote', false, dropdown);
	},
	setq: function (value)
	{	
		if (value == 'Left Quote') {
			var text = this.getSelectionText();
			this.insertHtml("<q class=\"left\">"+"> "+text+"<span class=\"cursorq\">&nbsp;</span>"+"</q>");
		};
		if (value == 'Right Quote') {
			var text = this.getSelectionText();
			this.insertHtml("<q class=\"right\">"+"> "+text+"<span class=\"cursorq\">&nbsp;</span>"+"</q>");
		};
		if (value == 'Center Quote') {
			var text = this.getSelectionText();
			this.insertHtml("<q class=\"center\">"+"> "+text+"<span class=\"cursorq\">&nbsp;</span>"+"</q>");
		};
	},
	resetq: function()
	{
		this.execCommand('RemoveFormat', false, null);
	}
};