// Intro: 道客巴巴下载PDF
// Usage: 复制粘贴到控制台
// Date: 2026.04.14
// Tag: 网页脚本

$('#continueButton').click()
var keeps = $("#pageContainer").parentsUntil('body').toArray().concat($("#pageContainer").children().toArray())
var divs = $("div:not(#pageContainer)").toArray()
divs.filter(x => keeps.indexOf(x) < 0).forEach(x => x.remove())
window.print()