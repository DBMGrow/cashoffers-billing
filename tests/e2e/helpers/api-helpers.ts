import axios from 'axios'

const API_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const API_KEY = process.env.API_KEY

/**
 * Create a test user in the database
 * Returns the user object: { user_id, email, api_token }
 */
export async function createTestUser(data: {
  email: string
  name: string
  role?: string
  whitelabel_id?: number
  is_premium?: number
}) {
  const response = await axios.post(
    `${API_BASE_URL}/api/test/create-user`,
    data,
    {
      headers: {
        'x-api-token': API_KEY,
      },
    }
  )
  // API returns { success, data: { user_id, email, api_token } }
  return response.data.data
}

/**
 * Create a test subscription
 * Returns the subscription object: { subscription_id }
 */
export async function createTestSubscription(data: {
  user_id: number
  product_id: number | string
  amount: number
  status?: string
  subscription_name?: string
}) {
  const response = await axios.post(
    `${API_BASE_URL}/api/test/create-subscription`,
    {
      ...data,
      status: data.status || 'active',
      subscription_name: data.subscription_name || 'Test Subscription',
    },
    {
      headers: {
        'x-api-token': API_KEY,
      },
    }
  )
  // API returns { success, data: { subscription_id } }
  return response.data.data
}

/**
 * Clean up test data
 */
export async function cleanupTestUser(email: string) {
  try {
    await axios.delete(`${API_BASE_URL}/api/test/cleanup-user`, {
      data: { email },
      headers: {
        'x-api-token': API_KEY,
      },
    })
  } catch (error) {
    console.warn('Failed to cleanup test user:', error)
  }
}

/**
 * Check if a product exists
 */
export async function getProduct(productId: number | string) {
  const response = await axios.get(
    `${API_BASE_URL}/api/product/${productId}`,
    {
      headers: {
        'x-api-token': API_KEY,
      },
    }
  )
  return response.data
}

/**
 * Get products for a whitelabel
 */
export async function getProductsForWhitelabel(whitelabel: string) {
  const response = await axios.get(
    `${API_BASE_URL}/api/signup/products?whitelabel=${whitelabel}`
  )
  return response.data
}
