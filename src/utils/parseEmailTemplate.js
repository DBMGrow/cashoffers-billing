import fs from "fs"
const promises = fs.promises

export default async function parseEmailTemplate(templateFile, templateData = {}) {
  try {
    let shell = await promises.readFile("./src/templates/shell.html", "utf-8")
    let htmlContent = await promises.readFile("./src/templates/" + templateFile, "utf-8")

    //replace {{content}} with htmlContent
    htmlContent = shell.replace("{{content}}", htmlContent)
    Object.keys(templateData).forEach((key) => {
      htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, "g"), templateData[key])
    })
    return htmlContent
  } catch (error) {
    console.error("0003B: ", error)
    return null
  }
}
