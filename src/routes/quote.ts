import express from 'express'
import { Resend } from 'resend'

const router = express.Router()

// Initialize Resend
const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

interface QuoteData {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  propertyInfo?: any
  propertyType?: string
  yearBuilt?: string
  squareFootage?: string
  floorsAboveGround?: string
  bedrooms?: string
  bathrooms?: string
  hasAttic?: string
  basementType?: string
  additionalNotes?: string
  ownership?: string
  heatingSource?: string
  installationTimeline?: string
  electricityProvider?: string
  naturalGasProvider?: string
  quote?: {
    totalPrice?: number
    estimatedSavings?: number
  }
}

router.post('/submit', async (req: express.Request, res: express.Response) => {
  try {
    const quoteData: QuoteData = req.body

    // Validate required fields
    if (!quoteData.firstName || !quoteData.lastName || !quoteData.email || !quoteData.phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: firstName, lastName, email, phone'
      })
    }

    // Format the email content
    const emailSubject = `New Quote Request - ${quoteData.firstName} ${quoteData.lastName}`
    
    const emailBody = `
NEW QUOTE REQUEST
=================

CONTACT INFORMATION
-------------------
Name: ${quoteData.firstName} ${quoteData.lastName}
Email: ${quoteData.email}
Phone: ${quoteData.phone}

ADDRESS
-------
${quoteData.address}
${quoteData.city}, ${quoteData.state} ${quoteData.zipCode}

PROPERTY INFORMATION
-------------------
${quoteData.propertyInfo ? `
Year Built: ${quoteData.propertyInfo.yearBuilt || 'N/A'}
Total Assessed Value: ${quoteData.propertyInfo.totalValue || 'N/A'}
Lot Size: ${quoteData.propertyInfo.lotSize || 'N/A'}
Assessment Year: ${quoteData.propertyInfo.assessmentYear || 'N/A'}
Last Sale Price: ${quoteData.propertyInfo.lastSalePrice || 'N/A'}
Last Sale Date: ${quoteData.propertyInfo.lastSaleDate || 'N/A'}
Owner: ${quoteData.propertyInfo.owner || 'N/A'}
Owner Address: ${quoteData.propertyInfo.ownerAddress || 'N/A'}
Building Value: ${quoteData.propertyInfo.buildingValue || 'N/A'}
Land Value: ${quoteData.propertyInfo.landValue || 'N/A'}
Use Code: ${quoteData.propertyInfo.useCode || 'N/A'}
` : 'No property information available'}

HOME DETAILS
-----------
Property Type: ${quoteData.propertyType || 'N/A'}
Year Built: ${quoteData.yearBuilt || 'N/A'}
Square Footage: ${quoteData.squareFootage || 'N/A'}
Floors Above Ground: ${quoteData.floorsAboveGround || 'N/A'}
Bedrooms: ${quoteData.bedrooms || 'N/A'}
Bathrooms: ${quoteData.bathrooms || 'N/A'}
Has Attic: ${quoteData.hasAttic || 'N/A'}
Basement Type: ${quoteData.basementType || 'N/A'}
Additional Notes: ${quoteData.additionalNotes || 'None'}

ADDITIONAL INFORMATION
---------------------
Ownership: ${quoteData.ownership || 'N/A'}
Heating Source: ${quoteData.heatingSource || 'N/A'}
Installation Timeline: ${quoteData.installationTimeline || 'N/A'}

UTILITY PROVIDERS
----------------
Electricity Provider: ${quoteData.electricityProvider || 'N/A'}
Natural Gas Provider: ${quoteData.naturalGasProvider || 'N/A'}

QUOTE SUMMARY
------------
Total Price: $${quoteData.quote?.totalPrice?.toLocaleString() || 'N/A'}
Estimated Annual Savings: $${quoteData.quote?.estimatedSavings?.toLocaleString() || 'N/A'}

---
This quote was generated automatically from the Valor Heating & Cooling website.
Submitted: ${new Date().toLocaleString()}
`

    const recipientEmail = process.env.QUOTE_RECIPIENT_EMAIL || 'admin@valorhvacma.com'
    
    // Try to send email using Resend if API key is configured
    if (resend && resendApiKey) {
      try {
        // Use onboarding@resend.dev if the from email is not verified
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
        
        // If using a gmail.com or other unverified domain, use Resend's test domain
        const safeFromEmail = fromEmail.includes('@gmail.com') || fromEmail.includes('@yahoo.com') || fromEmail.includes('@outlook.com')
          ? 'onboarding@resend.dev'
          : fromEmail
        
        const { data, error } = await resend.emails.send({
          from: safeFromEmail,
          to: recipientEmail,
          subject: emailSubject,
          text: emailBody,
        })

        if (error) {
          throw new Error(`Resend error: ${JSON.stringify(error)}`)
        } else {
          return res.json({ 
            success: true, 
            message: 'Quote submitted and email sent successfully',
            emailId: data?.id
          })
        }
      } catch (resendError: any) {
        return res.status(500).json({
          success: false,
          error: resendError.message || 'Failed to send email via Resend',
          details: resendError
        })
      }
    }
    
    // Fallback: Return error if email service is not configured
    return res.status(500).json({ 
      success: false,
      message: 'Email service not configured. Please set RESEND_API_KEY in environment variables.',
    })
  } catch (error: any) {
    console.error('Quote submission error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send quote email'
    })
  }
})

export default router
