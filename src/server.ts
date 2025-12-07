import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import quoteRoutes from './routes/quote'
import propertyRoutes from './routes/property'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/quote', quoteRoutes)
app.use('/api/property', propertyRoutes)

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Valor HVAC Backend Server running on port ${PORT}`)
  console.log(`📡 Health check: http://localhost:${PORT}/health`)
  console.log(`🔗 API base URL: http://localhost:${PORT}/api`)
})
