import axios from "axios"

// factory function, allows passing in options
export default function fetcher(url, options = {}) {
  return async function () {
    try {
      const response = await axios({
        url,
        ...options,
      })
      return response.data
    } catch (error) {
      console.error(error)
      return error
    }
  }
}
