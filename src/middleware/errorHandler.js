/**
 * @param {Error} err
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
const errorHandler = (err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    success: "error",
    status: "error",
    error: err.message,
  })
}
export default errorHandler
