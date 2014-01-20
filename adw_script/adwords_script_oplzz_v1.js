//LOAD SCRIPT FROM URL:

// eval(UrlFetchApp.fetch("http://github.....").getContentText())

////////CONTENT OF GITHUB REPO START ////////////

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License

function parseUri (str) {
  var o   = parseUri.options,
    m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
    uri = {},
    i   = 14;

  while (i--) uri[o.key[i]] = m[i] || "";

  uri[o.q.name] = {};
  uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
    if ($1) uri[o.q.name][$1] = $2;
  });

  return uri;
};

parseUri.options = {
  strictMode: false,
  key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
  q:   {
    name:   "queryKey",
    parser: /(?:^|&)([^&=]*)=?([^&]*)/g
  },
  parser: {
    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
    loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};

// Send request to W3C RDFA Distiler with uri param to let distiler parse given url and return JSON object
function load_rdfa_from_url(url) {
  //Base URL for W3C RDFA distiler (parse givven page an return JSON)
  var w3c_url = "http://www.w3.org/2012/pyRdfa/extract?format=json&rdfagraph=output&vocab_expansion=false&rdfa_lite=false&embedded_rdf=false&space_preserve=false&vocab_cache=false&vocab_cache_report=false&vocab_cache_refresh=false";

  //Compose W3C url + add requestet URL as param
  var composed_url = w3c_url+"&uri="+encodeURIComponent(url);

  //Get data
  var json_data = UrlFetchApp.fetch(composed_url).getContentText();

  if(json_data) {
    //parse data
    return Utilities.jsonParse(json_data);
  } else {
    return {}
  }
}

// Get Job Postings from given URL
function load_job_postings_from_url(url) {

  data = load_rdfa_from_url(url);
  Logger.log("Importer: Validating data for "+url);

  //In context must be JobPosting - if not there are no JobPostings!
  if(data["@context"] && data["@context"]["JobPosting"] != "http://schema.org/JobPosting") {
    //there is no JobPosting in his URL
    Logger.log("Importer: given url: "+url+" Has no JobPostings!");
    Logger.log(data);

    return [];

  } else {
    var graph = data["@graph"];
    var output = [];
    //Looking for object with JobPosting
    for(var index in graph) {

      var item = graph[index];
      try {
        //Show original data
        //Logger.log(item)

        if (item["@type"] == "JobPosting") {
          var jobPosting = {
            title: item["title"]["@value"]
          }
          jobPosting['url']             = item["url"] || url;
          jobPosting['addressRegion']   = item["address"]["addressRegion"]["@value"];
          jobPosting['addressLocality'] = item["address"]["addressLocality"]["@value"];
          jobPosting['availibility']    = true;

          output.push(jobPosting);
          Logger.log("Importer: founded: "+Utilities.jsonStringify(jobPosting));
        }
      } catch(error) {
        Logger.log("Problem with parsing: ("+error+")");
        Logger.log(item);
      }

    }

    return output;
  }
}

function find_campaign(name) {
  campaign_selector = AdWordsApp.campaigns().withCondition("Name CONTAINS_IGNORE_CASE '"+name+"'").get();
  if(campaign_selector.totalNumEntities() == 1) {
    return campaign_selector.next();
  } else {
    return undefined;
  }
}

function create_adgroup(campaign, name, adtexts, keywords, negativeKeywords) {
  var adGroupBuilder = campaign.newAdGroupBuilder();
  var adGroup = adGroupBuilder
    .withName(name)
    .create();

  for(var i in adtexts) {
    ad = adtexts[i];
    adGroup.createTextAd(ad['headline'], ad['line1'], ad['line2'], ad['display_url'], ad['destination_url']);
  }

  for(var i in keywords) {
    adGroup.createKeyword(keywords[i])
  }

  for(var i in negativeKeywords) {
    adGroup.createNegativeKeyword(negativeKeywords[i]);
  }

  return adGroup;
}

function generate_url_with_utm(url,utms) {
  return url;
}

function generate_display_url(url) {
  return parseUri(url).host
}

function fix_special_characters_in_keywords(keywords) {
  var output = [];
  for(var i in keywords) {
    var kw = keywords[i];
    output.push(kw.replace( /\(|\)|\/|\\|-|_|\[|\]\|!|\+|,|\.|´|\"|'/g ," ").replace(/\s+/g, " ").toLowerCase());
  }

  return output;
}

function generate_match_types_to_keywords(keywords, match_types) {
  var output = [];
  for(var i in keywords) {
    var kw = keywords[i];
    if(match_types.indexOf("broad") != -1) {
      output.push(kw);
    }
    if(match_types.indexOf("phrase") != -1) {
      output.push("["+kw+"]");
    }
    if(match_types.indexOf("exact") != -1) {
      output.push("\""+kw+"\"");
    }
  }

  return output;
}

////////CONTENT OF GITHUB REPO END ////////////


function main() {


  //SETUP:

  var urls = [
    "http://www.job-it.cz/index.php?page=item&id=107",
  ]

  var campaing_name = "TEST12";

  var adtextHeadline = "Hledáte práci?";
  var negativeKeywords = ["porno"];

  var jobPostings = [];


  //!!!!!! DON'T TOUCH THIS !!!!!!!!!
  //MAIN PART OF GENERATING:

  //Find campaign
  campaign = find_campaign(campaing_name);
  if(campaign == undefined) {
    Logger.log("Campaign with name: "+campaing_name+" couldn't be found");
    return false;
  }

  //Load job postings from all urls
  for(var index in urls) {
    jobPostings = jobPostings.concat(load_job_postings_from_url(urls[index]))
  }

  for(var index in jobPostings){
    var job = jobPostings[index];

    //Set adtexts
    var adtexts = [
      {
        destination_url: generate_url_with_utm(job["url"]),
        display_url:     generate_display_url(job["url"]),
        headline:        adtextHeadline,
        line1:           job["title"].substring(0, 35),
        line2:           "Nachází se v "+job["addressRegion"],
      }
    ]

    //Set main keywords
    var keywords = [
      job["title"] + " " + job["addressRegion"],
      job["title"] + " " + job["addressLocality"],
      "nabídka práce "+job["title"],
    ]

    //Remove special characters from keywords
    keywords = fix_special_characters_in_keywords(keywords);

    //Generate match types for keywords
    keywords = generate_match_types_to_keywords(keywords, ["broad", "phrase"]);

    //Generate match types for negative keywords
    negativeKeywords = generate_match_types_to_keywords(negativeKeywords, ["broad"]);

    //Create adgroup with given data
    create_adgroup(campaign, job["title"]+" "+job["addressLocality"], adtexts, keywords, negativeKeywords);
  }
}