import FormData from "form-data"

export default function convertToFormata(json) {
  const formData = new FormData()
  for (const key in json) {
    formData.append(key, json[key])
  }
  return formData
}
