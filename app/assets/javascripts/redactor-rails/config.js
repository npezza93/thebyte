$(document).ready(
  function(){
  var csrf_token = $('meta[name=csrf-token]').attr('content');
  var csrf_param = $('meta[name=csrf-param]').attr('content');
  var params;
  if (csrf_param !== undefined && csrf_token !== undefined) {
    params = csrf_param + "=" + encodeURIComponent(csrf_token);
  }
  $('.redactor').redactor(
    { "imageUpload":"/redactor_rails/pictures?" + params,
      "imageGetJson":"/redactor_rails/pictures",
      "fileUpload":"/redactor_rails/documents?" + params,
      "fileGetJson":"/redactor_rails/documents",
      "path":"/assets/redactor-rails",
      "css":"style.css",
      "cleanFontTag": false,
      "cleanup": false,
      "convertDivs":false,
      "convertImageLinks": true,
      "convertVideoLinks": true,
      "imageFloatMargin": '15px',
      "linksize": 25,
      "minHeight": 300,
      "plugins": ['fontcolor', 'q', 'fontsize', 'fontfamilynew'],
      "paragraphy": false,
      "pastePlainText": true
    });
  $('.redactor_comments').redactor(
    { "imageUpload":"/redactor_rails/pictures?" + params,
      "imageGetJson":"/redactor_rails/pictures",
      "fileUpload":"/redactor_rails/documents?" + params,
      "fileGetJson":"/redactor_rails/documents",
      "path":"/assets/redactor-rails",
      "css":"style.css",
      "convertImageLinks": true,
      "convertVideoLinks": true,
      "imageFloatMargin": '15px',
      "linksize": 25,
      "minHeight": 150,
      "plugins": ['fontcolor', 'fontsize', 'fontfamilynew'],
      "paragraphy": false,
      "pastePlainText": true,
      "buttons": ['formatting', '|', 'bold', 'italic', 'deleted', '|', 'unorderedlist', 'orderedlist', '|', 'outdent', 'indent', , 'alignment', '|', 'image', 'video', 'fontsize', 'fontfamilynew']
    });
});
