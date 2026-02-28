import { createError, defineEventHandler, readMultipartFormData } from 'h3'

interface PinataUploadResponse {
  IpfsHash: string
}

const PINATA_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'

async function uploadFileToPinata(
  jwt: string,
  body: Buffer,
  contentType: string,
  name: string,
): Promise<string> {
  const formData = new FormData()
  const blob = new Blob([body], { type: contentType || 'application/octet-stream' })
  formData.append('file', blob, name)
  formData.append(
    'pinataMetadata',
    JSON.stringify({
      name,
    }),
  )

  const response = await fetch(PINATA_FILE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const detail = await response.text()
    throw createError({
      statusCode: 502,
      statusMessage: `Pinata file upload failed: ${detail || response.statusText}`,
    })
  }

  const data = (await response.json()) as PinataUploadResponse
  if (!data?.IpfsHash) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Pinata file upload returned no CID',
    })
  }
  return data.IpfsHash
}

async function uploadJsonToPinata(jwt: string, payload: unknown, name: string): Promise<string> {
  const response = await fetch(PINATA_JSON_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataMetadata: { name },
      pinataContent: payload,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw createError({
      statusCode: 502,
      statusMessage: `Pinata JSON upload failed: ${detail || response.statusText}`,
    })
  }

  const data = (await response.json()) as PinataUploadResponse
  if (!data?.IpfsHash) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Pinata JSON upload returned no CID',
    })
  }
  return data.IpfsHash
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const pinataJwt = config.pinataJwt

  if (!pinataJwt) {
    throw createError({
      statusCode: 500,
      statusMessage: 'PINATA_JWT is not configured',
    })
  }

  const multipart = await readMultipartFormData(event)
  if (!multipart) {
    throw createError({ statusCode: 400, statusMessage: 'Expected multipart form data' })
  }

  const field = (name: string): string =>
    multipart.find((part) => part.name === name)?.data?.toString('utf-8')?.trim() || ''

  const imagePart = multipart.find((part) => part.name === 'image')
  if (!imagePart?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Image file is required' })
  }

  const title = field('title')
  const description = field('description')
  const startPriceXrp = field('startPriceXrp')
  const minIncrementXrp = field('minIncrementXrp')
  const startTime = field('startTime')
  const endTime = field('endTime')
  const sellerAddress = field('sellerAddress')
  const auctionId = field('auctionId')

  if (!title || !startTime || !endTime || !sellerAddress || !auctionId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required metadata fields' })
  }

  const imageCid = await uploadFileToPinata(
    pinataJwt,
    imagePart.data,
    imagePart.type || 'application/octet-stream',
    imagePart.filename || `auction-image-${Date.now()}`,
  )

  const metadata = {
    name: title,
    description,
    image: `ipfs://${imageCid}`,
    external_url: `https://testnet.xrpl.org/`,
    properties: {
      auctionId,
      sellerAddress,
      startPriceXrp,
      minIncrementXrp,
      startTime,
      endTime,
      createdAt: new Date().toISOString(),
    },
  }

  const metaCid = await uploadJsonToPinata(
    pinataJwt,
    metadata,
    `${auctionId}.json`,
  )

  return {
    imageCid,
    metaCid,
    metadata,
  }
})
