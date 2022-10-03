const mongoose = require('mongoose')
const urlModel = require('../models/urlModel')
const validUrl = require('valid-url')
const shortId = require('shortid')

const redis = require("redis");

const { promisify } = require("util");

//Connect to redis
const redisClient = redis.createClient(
    16492,
    "redis-16492.c301.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("OJB13HeEpQu8bD9WkLOmealx199vnYoU", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});


//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

const urlShortener = async function (req, res) {
    try {
        let longUrl = req.body.longUrl

        if (!longUrl) {
            return res.status(400).send({ status: false, message: "LongUrl is mandatory" })
        }

        if (!validUrl.isUri(longUrl)) {
            return res.status(400).send({ status: false, message: "Url is not valid" })
        }

        let getDetails = await GET_ASYNC(`${longUrl}`)
        console.log(JSON.parse(getDetails))
        if (getDetails) {
            return res.send({ data: JSON.parse(getDetails) })
        }

        let existUrl = await urlModel.findOne({ longUrl }).select({ _id: 0, longUrl: 1, shortUrl: 1, urlCode: 1 })
        if (existUrl) {
            return res.status(200).send({ status: true, data: existUrl })
        }
        let baseUrl = "http://localhost:3000"
        const urlCode = shortId.generate().toLowerCase()

        const shortUrl = baseUrl + '/' + urlCode

        let all = {
            longUrl: longUrl,
            shortUrl: shortUrl,
            urlCode: urlCode
        };
        let Data = await SET_ASYNC(`${longUrl}`, JSON.stringify(all))
        //console.log(Data)
        let urlData = await urlModel.create(all)
        return res.status(201).send({ status: true, data: urlData })


    } catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }
}

const getUrl = async function (req, res) {
    try {
        let urlCode = req.params.urlCode
        // console.log(typeof urlCode);
        if (!urlCode) return res.status(400).send({ status: false, message: "please give urlcode in params" })
        let getDetails = await GET_ASYNC(`${req.params.urlCode}`)
        //  console.log(getDetails)
        if (getDetails) {
            console.log("done")
            return res.redirect(JSON.parse(getDetails).longUrl)
        }

        let urlData = await urlModel.findOne({ urlCode })
        await SET_ASYNC(`${urlCode}`, JSON.stringify(urlData))
        if (!urlData) return res.status(404).send({ status: false, message: `no url found with this ${urlCode}` })

        return res.redirect(urlData.longUrl)
    } catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }
}



module.exports = { urlShortener, getUrl }