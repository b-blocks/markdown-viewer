// server.js
const express = require('express')
const axios = require('axios')
const path = require('path')
const cors = require('cors')
const compression = require('compression')

const app = express()
const port = 3000

// Enable gzip compression for all responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false
    }
    return compression.filter(req, res)
  },
  level: 6 // Compression level (0-9, 6 is default)
}))

app.use(cors())
app.use(express.static(path.join(__dirname, 'public'))) // Serve static files from the 'public' directory

app.get('/fetch-markdown', async (req, res) => {
  const { url } = req.query

  if (!url) {
    return res.status(400).send({ error: 'URL is required' })
  }

  try {
    // Validate that the URL is a raw.githubusercontent.com URL for security
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname !== 'raw.githubusercontent.com') {
      return res.status(400).send({
        error: 'Invalid hostname. Only raw.githubusercontent.com URLs are allowed.'
      })
    }

    const response = await axios.get(url)

    // Set cache headers for better performance on repeated loads
    res.set({
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      'Content-Type': 'text/plain; charset=utf-8'
    })

    res.send(response.data)
  } catch (error) {
    console.error('Error fetching markdown:', error.message)
    res.status(500).send({ error: 'Failed to fetch markdown from the provided URL.' })
  }
})

app.listen(port, () => {
  console.log(`Markdown Viewer server listening at http://localhost:${port}`)
})
