/*!
 * froala_editor v1.2.8 (https://www.froala.com/wysiwyg-editor)
 * License https://www.froala.com/wysiwyg-editor/terms
 * Copyright 2014-2015 Froala Labs
 */

Array.prototype.indexOf||(Array.prototype.indexOf=function(a){if(void 0===this||null===this)throw TypeError();var b=Object(this),c=b.length>>>0;if(0===c)return-1;var d=0;if(arguments.length>0&&(d=Number(arguments[1]),isNaN(d)?d=0:0!==d&&d!==1/0&&d!==-(1/0)&&(d=(d>0||-1)*Math.floor(Math.abs(d)))),d>=c)return-1;for(var e=d>=0?d:Math.max(c-Math.abs(d),0);c>e;e++)if(e in b&&b[e]===a)return e;return-1}),String.prototype.trim||(String.prototype.trim=function(){return String(this).replace(/^\s+/,"").replace(/\s+$/,"")}),Object.keys||(Object.keys=function(a){var b=[];for(var c in a)a.hasOwnProperty(c)&&b.push(c);return b});var Node=Node||{ELEMENT_NODE:1,ATTRIBUTE_NODE:2,TEXT_NODE:3};$.Editable.prototype.saveSelection=function(){var a=window.document.selection;this.savedSelection="None"!=a.type?a.createRange():null},$.Editable.prototype.restoreSelection=function(){this.selectionDisabled||this.savedSelection&&this.savedSelection.select()},$.Editable.prototype.getSelectionTextInfo=function(){return!1},$.Editable.DEFAULTS.blockTags={n:"Normal",h1:"Heading 1",h2:"Heading 2",h3:"Heading 3",h4:"Heading 4",h5:"Heading 5",h6:"Heading 6"};
