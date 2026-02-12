export default function YoutubeVideo() {
  return (
    <div className="w-full flex items-center justify-center">
      <iframe
        width="560"
        height="315"
        src="https://www.youtube.com/embed/hvQrZJi-kEE?si=It8Lf_hOHhJhcgUE&rel=0&autoplay=1"
        title="YouTube video player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>
    </div>
  )
}
