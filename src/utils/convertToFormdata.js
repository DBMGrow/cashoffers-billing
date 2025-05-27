import FormData from "form-data"
import CodedError from "../lib/CodedError"

export default function convertToFormata(json) {
  try {
    const formData = new FormData()

    console.log(json)

    const append = (key, value) => {
      const keyIsUndefined = typeof value === "undefined"
      const valueIsUndefined = typeof value === "undefined"
      const valueIsNull = value === null || value === "null"

      if (keyIsUndefined || valueIsUndefined || valueIsNull) return

      formData.append(key, json?.[key])
    }

    for (const key in json) {
      console.log("key", key)
      console.log("value", json?.[key])

      append(key, json?.[key])
    }
    return formData
  } catch (error) {
    throw new CodedError(error, "CON1")
  }
}
