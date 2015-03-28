

document.addEventListener('DOMContentLoaded', function() {
  var info = document.getElementById('registrationid');
  info.value = 'Loading...';
  chrome.runtime.onMessage.addListener(function(msg){
    if (msg.subject === 'SetRegistrationId') {
      info.value = msg.id || 'No registration value';
    }
  });
  chrome.runtime.sendMessage({subject: 'GetRegistrationId'});
});

