var parent1 = chrome.contextMenus.create({"title": "Send To"});
var child1 = chrome.contextMenus.create(
  {"title": "Person 1", "parentId": parent1, "onclick": sendTo});
var child2 = chrome.contextMenus.create(
  {"title": "Person 2", "parentId": parent1, "onclick": sentTo});
var parent2 = chrome.contextMenus.create({"title": "Send To (and close)"});
var child1 = chrome.contextMenus.create(
  {"title": "Person 1", "parentId": parent2, "onclick": sendTo});
var child2 = chrome.contextMenus.create(
  {"title": "Person 2", "parentId": parent2, "onclick": sentTo});
