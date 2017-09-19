const express = require('express');
const https = require('https');
const config = require('./config');
const fs = require('fs');

/**
  Require config with Azure API Key
**/

let app = express();

app.get('/', (req, res) => {
  res.send({status: 200});
});

app.get('/image-search/latest', (req, res) => {
  fs.readFile('latest.json', 'utf8', (err, data) => {
    if (err) {
      return res.send({error: err});
    }
    res.send(JSON.parse(data));
  })
})

app.get('/image-search/:query', (req, res) => {

  let query = encodeURIComponent(req.params.query);
  let offset = req.query.offset ? "&offset=" + req.query.offset : "&offset=0";

  if (query) {

    fs.readFile('latest.json', 'utf8', (err, data) => {
      let db = JSON.parse(data);
      const date = new Date();

      // Add the query to the DB
      db.unshift({
        term: decodeURIComponent(query).split('+').join(' '),
        when: date.toISOString()
      });

      // If more than 10 records in the DB remove the last one.
      if(db.length > 10) {
        db.pop();
      }

      // Write the updated DB to file
      fs.writeFile('latest.json', JSON.stringify(db), err => {
        if (err) {
          console.log('Error writing the updated latest DB to file', err);
        }
        console.log('DB File Updated');
      });
    })

    // Construct the Bing Image API request
    const options = {
      hostname: 'api.cognitive.microsoft.com',
      path: "https://api.cognitive.microsoft.com/bing/v5.0/images/search?count=10&q=" + query + offset,
      headers: {
        "Ocp-Apim-Subscription-Key": config.azureKey
      }
    }
    https.get(options, (response) => {
      response.setEncoding('utf8');
      let json = "";
      response.on('data', d => {
        json += d;
      }).on('end', () => {
        // Pull the images from the response and create an Array of the required information to return
        return res.send(JSON.parse(json).value.map(image => {
          return {
            url: decodeURIComponent(image.contentUrl.match(/&r=(.*)/)[1]).split('&p=')[0],
            snippet: image.name,
            thumbnail: image.thumbnailUrl,
            context: image.hostPageDisplayUrl
          }
        }));
      })
    }).on('error', (err) => {
      return res.send({error: err});
    });
  } else {
    console.log('No query');
    res.send({message: "No query string supplied"});
  }
})

app.listen(3000, () => {
  console.log('Listening on port 3000');
})
