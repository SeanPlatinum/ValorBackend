import express, { Request, Response } from 'express'
import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer'

const router = express.Router()

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface PropertyInfo {
  owner?: string
  ownerAddress?: string
  buildingValue?: string
  landValue?: string
  otherValue?: string
  totalValue?: string
  assessmentYear?: string
  lotSize?: string
  lastSalePrice?: string
  lastSaleDate?: string
  useCode?: string
  yearBuilt?: string
}

router.post('/info', async (req: Request, res: Response) => {
  let browser: any = null
  
  try {
    const { city, streetName, addressNumber } = req.body

    if (!city || !streetName || !addressNumber) {
      return res.status(400).json({
        error: 'City, street name, and address number are required'
      })
    }

    const baseUrl = 'https://arcgisserver.digital.mass.gov/ParcelAccessibility2/MassPropertyInfo.aspx'
    
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    })
    
    const page = await browser.newPage()
    
    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    
    // Wait for the form to load
    await page.waitForSelector('select', { timeout: 10000 })
    
    // Find the dropdowns
    const selects = await page.$$eval('select', (selects: HTMLSelectElement[]) => {
      return selects.map((select: HTMLSelectElement, index: number) => ({
        index,
        id: select.id,
        name: select.name,
        options: Array.from(select.options).map((opt: HTMLOptionElement) => ({
          value: opt.value,
          text: opt.text.trim()
        }))
      }))
    })
    
    // Identify dropdowns by their position or content
    let citySelect: any = null
    let streetSelect: any = null
    let addressSelect: any = null
    
    // Try to find by ID/name first
    for (const select of selects) {
      const idLower = select.id.toLowerCase()
      const nameLower = select.name.toLowerCase()
      
      if ((idLower.includes('city') || idLower.includes('town') || nameLower.includes('city') || nameLower.includes('town')) && !citySelect) {
        citySelect = select
      } else if ((idLower.includes('street') || nameLower.includes('street')) && !streetSelect) {
        streetSelect = select
      } else if ((idLower.includes('address') || idLower.includes('number') || nameLower.includes('address') || nameLower.includes('number')) && !addressSelect) {
        addressSelect = select
      }
    }
    
    // Fallback: assume order (city, street, address)
    if (!citySelect && selects.length >= 1) citySelect = selects[0]
    if (!streetSelect && selects.length >= 2) streetSelect = selects[1]
    if (!addressSelect && selects.length >= 3) addressSelect = selects[2]
    
    if (!citySelect || !streetSelect || !addressSelect) {
      throw new Error(`Could not find all required dropdowns. Found ${selects.length} selects.`)
    }
    
    // Normalize inputs
    const normalizedCity = city.toUpperCase().trim()
    const normalizedStreet = streetName.toUpperCase().trim()
    const normalizedAddress = addressNumber.trim()
    
    // Select city
    const citySelector = citySelect.id ? `#${citySelect.id}` : `select[name="${citySelect.name}"]`
    const cityOption = citySelect.options.find((opt: any) => 
      opt.text.toUpperCase() === normalizedCity || 
      opt.value.toUpperCase() === normalizedCity ||
      opt.text.toUpperCase().includes(normalizedCity) ||
      normalizedCity.includes(opt.text.toUpperCase())
    )
    const cityValue = cityOption ? cityOption.value : citySelect.options.find((opt: any) => opt.value)?.value || ''
    
    if (cityValue) {
      await page.select(citySelector, cityValue)
    } else {
      throw new Error(`Could not find city option for: ${city}`)
    }
    
    // Wait for street dropdown to populate
    const streetSelector = streetSelect.id ? `#${streetSelect.id}` : `select[name="${streetSelect.name}"]`
    
    try {
      await page.waitForFunction(
        (selector: string) => {
          const select = document.querySelector(selector) as HTMLSelectElement
          return select && select.options.length > 1
        },
        { timeout: 15000 },
        streetSelector
      )
    } catch (e) {
      await delay(3000)
    }
    
    const streetSelectElement = await page.$(streetSelector)
    if (!streetSelectElement) {
      throw new Error(`Street select element not found: ${streetSelector}`)
    }
    
    const updatedStreetOptions = await page.$eval(
      streetSelector,
      (select: HTMLSelectElement) => Array.from(select.options).map((opt: HTMLOptionElement) => ({
        value: opt.value,
        text: opt.text.trim()
      }))
    )
    
    const streetOption = updatedStreetOptions.find((opt: any) => 
      opt.text.toUpperCase().includes(normalizedStreet) ||
      opt.value.toUpperCase().includes(normalizedStreet) ||
      normalizedStreet.includes(opt.text.toUpperCase())
    )
    const streetValue = streetOption ? streetOption.value : updatedStreetOptions.find((opt: any) => opt.value)?.value || ''
    
    if (streetValue) {
      await page.select(streetSelector, streetValue)
    } else {
      throw new Error(`Could not find street option for: ${streetName}`)
    }
    
    // Wait for address dropdown to populate
    const addressSelector = addressSelect.id ? `#${addressSelect.id}` : `select[name="${addressSelect.name}"]`
    
    try {
      await page.waitForFunction(
        (selector: string) => {
          const select = document.querySelector(selector) as HTMLSelectElement
          return select && select.options.length > 1
        },
        { timeout: 15000 },
        addressSelector
      )
    } catch (e) {
      await delay(3000)
    }
    
    const addressSelectElement = await page.$(addressSelector)
    if (!addressSelectElement) {
      throw new Error(`Address select element not found: ${addressSelector}`)
    }
    
    const updatedAddressOptions = await page.$eval(
      addressSelector,
      (select: HTMLSelectElement) => Array.from(select.options).map((opt: HTMLOptionElement) => ({
        value: opt.value,
        text: opt.text.trim()
      }))
    )
    
    const addressOption = updatedAddressOptions.find((opt: any) => 
      opt.text.trim() === normalizedAddress ||
      opt.value.trim() === normalizedAddress
    )
    const addressValue = addressOption ? addressOption.value : updatedAddressOptions.find((opt: any) => opt.value)?.value || ''
    
    if (addressValue) {
      await page.select(addressSelector, addressValue)
    } else {
      throw new Error(`Could not find address option for: ${addressNumber}`)
    }
    
    await delay(1000)
    
    // Find and click the submit button
    const submitButton = await page.$('input[type="submit"], button[type="submit"], input[value*="Get Information" i], input[value*="Submit" i]')
    
    if (submitButton) {
      await submitButton.click()
    } else {
      await page.keyboard.press('Enter')
    }
    
    // Wait for results to load
    await delay(3000)
    await page.waitForSelector('table, .property-info, [class*="result"], [id*="result"]', { timeout: 15000 }).catch(() => {})
    
    // Get the page content
    const html = await page.content()
    const $ = cheerio.load(html)

    // Parse the property information
    const propertyInfo: PropertyInfo = {}
    const pageText = $('body').text()
    
    // Extract data from tables
    $('table tr, table td').each((_, el) => {
      const text = $(el).text().trim()
      const parentText = $(el).parent().text().trim()

      if (text.includes('Owner:') || parentText.includes('Owner:')) {
        const ownerText = text.replace('Owner:', '').trim() || parentText.replace('Owner:', '').trim()
        if (ownerText) propertyInfo.owner = ownerText
      }

      if (text.includes('Owner Address:') || parentText.includes('Owner Address:')) {
        const addressLines: string[] = []
        $(el).nextAll('td, div, span').each((_, nextEl) => {
          const nextText = $(nextEl).text().trim()
          if (nextText && !nextText.includes('Building Value')) {
            addressLines.push(nextText)
          } else {
            return false
          }
        })
        if (addressLines.length > 0) {
          propertyInfo.ownerAddress = addressLines.join(', ')
        }
      }

      if (text.includes('Building Value:') || parentText.includes('Building Value:')) {
        const match = text.match(/\$[\d,]+/) || parentText.match(/\$[\d,]+/)
        if (match) propertyInfo.buildingValue = match[0]
      }

      if (text.includes('Land Value:') || parentText.includes('Land Value:')) {
        const match = text.match(/\$[\d,]+/) || parentText.match(/\$[\d,]+/)
        if (match) propertyInfo.landValue = match[0]
      }

      if (text.includes('Other Value:') || parentText.includes('Other Value:')) {
        const match = text.match(/\$[\d,]+/) || parentText.match(/\$[\d,]+/)
        if (match) propertyInfo.otherValue = match[0]
      }

      if (text.includes('Total Value:') || parentText.includes('Total Value:')) {
        const match = text.match(/\$[\d,]+/) || parentText.match(/\$[\d,]+/)
        if (match) propertyInfo.totalValue = match[0]
      }

      if (text.includes('Assessment data from') || text.includes('FY')) {
        const match = text.match(/FY\s+\d{4}/) || text.match(/\d{4}/)
        if (match) propertyInfo.assessmentYear = match[0]
      }

      if (text.includes('Lot Size:') || parentText.includes('Lot Size:')) {
        const match = text.match(/[\d.]+[\s]*Acres?/) || parentText.match(/[\d.]+[\s]*Acres?/)
        if (match) propertyInfo.lotSize = match[0]
      }

      if (text.includes('Last Sale Price:') || parentText.includes('Last Sale Price:')) {
        const match = text.match(/\$[\d,]+/) || parentText.match(/\$[\d,]+/)
        if (match) propertyInfo.lastSalePrice = match[0]
      }

      if (text.includes('Last Sale Date:') || parentText.includes('Last Sale Date:')) {
        const match = text.match(/\d{8}/) || parentText.match(/\d{8}/)
        if (match) propertyInfo.lastSaleDate = match[0]
      }

      if (text.includes('Use Code:') || parentText.includes('Use Code:')) {
        const match = text.match(/Use Code:\s*(\d+)/) || parentText.match(/Use Code:\s*(\d+)/)
        if (match) propertyInfo.useCode = match[1]
      }

      if (text.includes('Year Built:') || parentText.includes('Year Built:')) {
        const match = text.match(/Year Built:\s*(\d{4})/) || parentText.match(/Year Built:\s*(\d{4})/)
        if (match) propertyInfo.yearBuilt = match[1]
      }
    })

    // Fallback regex extraction
    if (!propertyInfo.yearBuilt) {
      const yearMatch = pageText.match(/Year Built[:\s]+(\d{4})/i)
      if (yearMatch) propertyInfo.yearBuilt = yearMatch[1]
    }
    
    if (!propertyInfo.totalValue) {
      const totalMatch = pageText.match(/Total Value[:\s]+\$?([\d,]+)/i)
      if (totalMatch) propertyInfo.totalValue = '$' + totalMatch[1]
    }
    
    if (!propertyInfo.lotSize) {
      const lotMatch = pageText.match(/Lot Size[:\s]+([\d.]+\s*Acres?)/i)
      if (lotMatch) propertyInfo.lotSize = lotMatch[1]
    }
    
    return res.json({ success: true, data: propertyInfo })
  } catch (error: any) {
    console.error('Property info error:', error)
    return res.status(500).json({
      error: error.message || 'Failed to fetch property information',
      details: 'Error occurred while fetching property information from Massachusetts Property Information site.'
    })
  } finally {
    // Always close the browser
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
})

export default router
