const aws = require('aws-sdk');
const lambda = new aws.Lambda();
const botBuilder = require('claudia-bot-builder');
const slackDelayedReply = botBuilder.slackDelayedReply;

const snow = require('snow-forecast-sfr');
const _ = require('lodash');

const api = botBuilder((message, apiRequest) => {
  return new Promise((resolve, reject) => {
    lambda.invoke({
      FunctionName: apiRequest.lambdaContext.functionName,
      Qualifier: apiRequest.lambdaContext.functionVersion,
      InvocationType: 'Event',
      Payload: JSON.stringify({
        slackEvent: message // this will enable us to detect the event later and filter it
      })
    }, (err, done) => {
      if (err) return reject(err);
      resolve(done);
    });
  }).then(() => {
    return { // the initial response
      text: `Ok, Let me check ...`,
      response_type: 'in_channel'
    }
  }).catch(() => {
    return `Could not ping forecast`
  });
});

api.intercept((event) => {
  if (!event.slackEvent) return event;

  const message = event.slackEvent; //original slack message sent to bot
  const place = message.text; // 'Pas-de-la-Casa'

  if (!_.trim(message.text).length) {
    return slackDelayedReply(message, {
      response_type: 'in_channel',
      text: 'Please specify place ...'
    })
      .then(() => false);
  }

  return new Promise((resolve, reject) => {
    snow.parseResort(place, 'mid', function (json) {
      var result = {};

      result.title = 'There is snow forecast say, on ' + place;

      result.attachments = _.map(json.forecast, function (cast) {
        return {
          title: cast.date,
          text: 'snow: ' + cast.snow + ' | rain: ' + cast.rain + ' | minTemp: ' + fToC(cast.minTemp) + ' | maxTemp: ' + fToC(cast.maxTemp)
        };
      });

      prepareAttachments(result);

      resolve(result);
    });
  }).then((result) => {
    return slackDelayedReply(message, {
      response_type: 'in_channel',
      text: result.title,
      attachments: result.attachments
    })
      .then(() => false);
  });
});

function fToC(f) {
  return Math.round((f - 32) / 1.8);
}

function prepareAttachments(result) {
  var attachments = [];

  _.each(_.groupBy(result.attachments, 'title'), function (items, title) {
    var attachment = {
      title: title,
      text: []
    };

    items.forEach(function (item) {
      attachment.text.push(item.text)
    });

    attachment.text = attachment.text.join('\n');

    attachments.push(attachment);
  });

  result.attachments = attachments;
}


module.exports = api;