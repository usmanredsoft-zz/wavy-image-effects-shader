function App()
{
	let slider = new WavySlider(document.querySelector("#canvas"), 350, 512, 15, "assets/images/image_1.png", "assets/images/alpha.png", 1.2);

	// To change the image, call
	// slider.changeImage(url to the image)
	// whenever you want.

	let image_id = 1;

	setInterval(
		() =>
		{
			image_id++;

			if (image_id > 3)
			{
				image_id = 1;
			}
			slider.changeImage(`assets/images/image_${image_id}.png`)
		},
		3000
	);

}
new App();