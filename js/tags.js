// christopher pietsch
// cpietsch@gmail.com
// 2015-2018

function Tags() {
  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 220,
      height = window.innerHeight;

  var container;
  var keywordsScale = d3.scale.linear();
  var keywordsOpacityScale = d3.scale.linear();
  var keywords = [];
  var wordBackground;
  var keywordsNestGlobal;
  var sortKeywords = "count";

  var filterWords = [];
  var data, filteredData;
  var activeWord;

  var x = d3.scale.ordinal()
    .rangeBands([0, width]);

  var sliceScale = d3.scale.linear().domain([1200,5000]).range([50, 200])

  var lock = false;
  var state = { init: false, search: '' };

  function tags(){ }

  tags.state = state

  tags.init = function(_data, config) {
    data = _data;

    container = d3.select(".page").append("div")
      .style("width", width + margin.left + margin.right)
      .style("height", height + margin.top + margin.bottom)
      .classed("tagcloud", true)
      .style("color", config.style.fontColor)
      .append("div")

    if (config.sortKeywords != undefined) {
      sortKeywords = config.sortKeywords;
    }

    tags.update();
  }

  tags.resize = function(){
    if(!state.init) return;

    width = 220,
    height = window.innerHeight;

    container
      .style("width", width + margin.left + margin.right)
      .style("height", height + margin.top + margin.bottom)

    x.rangeBands([0, width]);

    tags.update();
  }

  tags.filter = function(filterWords,highlight){
    data.forEach(function(d) {
      var search = state.search !== "" ? d.search.indexOf(state.search) > -1 : true
      var matches = filterWords.filter(function(word){
        return d.keywords.indexOf(word) > -1;
      });
      if(highlight) d.highlight = (matches.length == filterWords.length && search);
      else d.active = (matches.length == filterWords.length && search);
    });
  }

  tags.update = function() {

    tags.filter(filterWords);

    var keywords = [];
    data.forEach(function(d) {
      if(d.active){
        d.keywords.forEach(function(keyword) {
          keywords.push({ keyword: keyword, data: d });
        })
      }
    });

  keywordsNestGlobal =  d3.nest()
      .key(function(d) { return d.keyword; })
      .rollup(function(d){
        return d.map(function(d){ return d.data; });
      })
      .entries(keywords)
      .sort(function(a,b){
        return b.values.length - a.values.length;
      })

  var keywordsNest = keywordsNestGlobal;

    if (sortKeywords == "alphabetical") {
      keywordsNest = keywordsNest.sort(function(a,b){
        return d3.ascending(a.key[0], b.key[0]);
      });
    } else if (sortKeywords == "alfabetical-reverse") {
      keywordsNest = keywordsNest.sort(function(a,b){
        return d3.descending(a.key[0], b.key[0]);
      });
    } else if (sortKeywords == "count") {
      keywordsNest = keywordsNest.sort(function(a,b){
        return d3.descending(a.values.length, b.values.length);
      });
    } else if (sortKeywords == "count-reverse") {
      keywordsNest = keywordsNest.sort(function(a,b){
        return d3.ascending(a.values.length, b.values.length);
      });
    } else if (Array.isArray(sortKeywords)) {
      keywordsNest = keywordsNest.sort(function(a,b){
        var indexA = sortKeywords.indexOf(a.key);
        var indexB = sortKeywords.indexOf(b.key);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }

    var keywordsExtent = d3.extent(keywordsNest, function (d) {
      return d.values.length;
    });

    keywordsScale
      .domain(keywordsExtent)
      .range([10,20]);

    if(keywordsExtent[0]==keywordsExtent[1]) keywordsScale.range([15,15])

    keywordsOpacityScale
      .domain(keywordsExtent)
      .range([0.2,1]);

    layout(keywordsNest);
    tags.draw(keywordsNest);

  }

  function layout(data){
    // 세로 리스트: 레이아웃 계산 불필요
  };

  tags.draw = function(words) {

    var select = container
      .selectAll(".tag")
        .data(words, function(d){ return d.key; })

    select
      .classed("active", function(d){ return filterWords.indexOf(d.key) > -1; })
      .style("font-size", function(d) { return keywordsScale(d.values.length) + "px"; })
      .style("opacity", 1)

    var e = select.enter().append("div")
        .classed("tag", true)
        .on("mouseenter", tags.mouseenter)
        .on("mouseleave", tags.mouseleave)
        .on("click", tags.mouseclick)
        .style("font-size", function(d) { return keywordsScale(d.values.length) + "px"; })
        .style("opacity", 0)

    e.append("span")
        .text(function(d) { return d.key; })

    e.append("div")
      .classed("close", true)

    e.transition()
      .delay(400)
      .duration(0)
      .style("font-size", function(d) { return keywordsScale(d.values.length) + "px"; })
      .style("opacity", 1)

    select.exit()
      .style("opacity", 0)
      .remove();

  }

  tags.reset = function(){
    filterWords = []
    tags.update();
    tags.highlightWords(filterWords);
  }

  tags.mouseclick = function (d) {
    lock = true;

    if(filterWords.indexOf(d.key)>-1){
      _.remove(filterWords,function(d2){ return d2 == d.key; });
    } else {
      filterWords.push(d.key);
    }

    tags.update();
    tags.highlightWords(filterWords);

    setTimeout(function(){
      canvas.project(d);
    },300);

    lock = false
  }

  tags.mouseleave = function (d) {
    if(lock) return;

    container
      .selectAll(".tag")
      .style("opacity", 1)

    data.forEach(function(d){ d.highlight = d.active; })

    canvas.highlight();
  }

  tags.mouseenter = function (d1) {
    if(lock) return;

    var tempFilterWords = _.clone(filterWords);
    tempFilterWords.push(d1.key)

    tags.highlightWords(tempFilterWords);
  }

  tags.filterWords = function(words){

    tags.filter(words,1);

    container
      .selectAll(".tag")
      .style("opacity", function(d){
        return d.values.some(function(d){ return d.active; }) ? 1 : 0.2;
      })

    canvas.highlight();
  }

  tags.highlightWords = function(words){

    tags.filter(words,1);

    container
      .selectAll(".tag")
      .style("opacity", function(d){
        return d.values.some(function(d){ return d.highlight; }) ? 1 : 0.2;
      })

      canvas.highlight();
  }

  tags.search = function(query){

    state.search = query

    tags.filter(filterWords, true);
    tags.update();
    canvas.highlight();
    canvas.project()
  }

  return tags;

}
