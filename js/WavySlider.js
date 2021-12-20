/**
 * WavySlider
 * @param canvas - Canvas HTMLElement
 * @param images_width - Width of the images (all images should has the same width)
 * @param images_height - Height of the images (all images should has the same height)
 * @param transparent_margin - Transparent area around an image. Depends on "waves" intensity
 * @param first_image_url - URL of the first image
 * @param alpha_image_url - URL of the helper image for transition. This is black image with
 * width = Width of the images + Transparent area around an image * 2
 * and
 * height = Height of the images + Transparent area around an image * 2
 * and 1 pixel transparent row at the bottom.
 * @param transition_duration - Duration of swaping images (seconds)
 * @constructor
 */
function WavySlider(canvas, images_width, images_height, transparent_margin, first_image_url, alpha_image_url, transition_duration)
{
	let vertex_shader_source = `
			attribute vec2 a_position;
			attribute vec2 a_tex_coord;
			uniform vec2 u_resolution;
	
			varying vec2 v_tex_coord;
	
			void main()
			{
				gl_Position = vec4(((a_position / u_resolution * 2.0) - 1.0) * vec2(1.0, -1), 0, 1);
			
				v_tex_coord = a_tex_coord;
			}
		`;

	let fragment_shader_source = `
			precision mediump float;
	
			uniform sampler2D u_image0;		
			uniform sampler2D u_image1;		
			uniform sampler2D u_image2;		
			uniform float u_time;		
			uniform float u_mask_pos;		
			
			varying vec2 v_tex_coord;
			
			void main()
			{
      			vec2 uv = vec2(v_tex_coord.x, v_tex_coord.y);
      			vec2 mask_uv = vec2(v_tex_coord.x, v_tex_coord.y);
      			
      			float v1 = 5.0;
      			float v2 = 300.0;
      			float speed_coef = 3.0;

      			uv.x += sin(uv.y * v1 + ((u_time + uv.x / 1.5) * speed_coef)) / (v2 * 2.0);
      			uv.y += sin(uv.x * v1 + ((u_time + uv.y / 1.5) * speed_coef)) / v2;
      		
      			if (u_mask_pos != -0.1)
      			{
      				mask_uv.y += sin(uv.x * v1 * 3.0 * sin(10.0) + u_time * speed_coef * 6.0) / (v2 / 10.0);
      			}      		
				gl_FragColor = mix(texture2D(u_image0, uv), texture2D(u_image1, uv), texture2D(u_image2, vec2(mask_uv.x, mask_uv.y + u_mask_pos)).a);
			}
		`;

	let images;
	let images_loaded = 0;
	let is_set;
	let animation;

	canvas.width = images_width + transparent_margin * 2;
	canvas.height = images_height + transparent_margin * 2;

	transition_duration *= 1000;

	images = [];

	let images_urls = [first_image_url, first_image_url, alpha_image_url];

	for (let i = 0; i < 3; i++)
	{
		let image = document.createElement("img");

		image.texture_id = i;

		if (i != 2)
		{
			image.canvas = document.createElement("canvas");

			image.canvas.image = image;
			image.canvas.texture_id = image.texture_id;
			image.canvas.context_2d = image.canvas.getContext("2d");
		}
		image.addEventListener("load", imageLoaded);

		image.src = images_urls[i];

		images.push(image);
	}
	let web_gl_utils = new WebGLUtils(canvas, vertex_shader_source, fragment_shader_source);

	function imageLoaded(event)
	{
		let image = event.target;

		if (image.texture_id != 2)
		{
			image.canvas.width = image.width + transparent_margin * 2;
			image.canvas.height = image.height + transparent_margin * 2;

			image.canvas.context_2d.clearRect(0, 0, image.canvas.width, image.canvas.height);
			image.canvas.context_2d.drawImage(image, transparent_margin, transparent_margin);

			web_gl_utils.makeTexture(image.canvas);
		}
		else
		{
			web_gl_utils.makeTexture(image);
		}
		if (!is_set)
		{
			if (images_loaded < 3)
			{
				images_loaded++;
			}
			if (images_loaded == 3)
			{
				init();
			}
		}
	}

	function init(event)
	{
		is_set = true;

		animation = window.requestAnimationFrame(animate);
	}

	function changeImage(url)
	{
		web_gl_utils.changeImage(url, images[1].texture);

		images[1].addEventListener("load", startImagesTransition);

		images[1].src = url;
	}
	this.changeImage = changeImage;

	function startImagesTransition(target, values)
	{
		new window.TinyTween({
			target: {},
			from: { y: 1.1 },
			to: { y: -0.1 },
			duration: transition_duration,
			ease: "easeOutCubic",
			onProgress: web_gl_utils.changeMaskPosition
		});
	}

	function animate()
	{
		web_gl_utils.render();

		animation = window.requestAnimationFrame(animate);
	}

}

function WebGLUtils(canvas, vertex_shader_source, fragment_shader_source)
{
	let gl;
	let program;
	let position_attribute_location;
	let resolution_uniform_location;
	let tex_coord_attribute_location;
	let time_uniform_location;
	let mask_pos_uniform_location;
	let position_buffer;
	//let clear_texture;

	gl = canvas.getContext("webgl", { premultipliedAlpha: false });

	//clear_texture = gl.createTexture();

	createProgram(vertex_shader_source, fragment_shader_source);
	setupBuffers();

	function createProgram(vertex_shader_source, fragment_shader_source)
	{
		let vertex_shader = createShader(gl.VERTEX_SHADER, vertex_shader_source);
		let fragment_shader = createShader(gl.FRAGMENT_SHADER, fragment_shader_source);

		program = gl.createProgram();

		gl.attachShader(program, vertex_shader);
		gl.attachShader(program, fragment_shader);

		gl.linkProgram(program);
		gl.useProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
		{

			console.log(gl.getProgramInfoLog(program));

			gl.deleteProgram(program);
		}
	}

	function createShader(type, source)
	{
		let shader = gl.createShader(type);

		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
		{
			return shader;
		}

		console.log(gl.getShaderInfoLog(shader));

		gl.deleteShader(shader);
	}

	function setupBuffers()
	{
		position_attribute_location = gl.getAttribLocation(program, "a_position");
		resolution_uniform_location = gl.getUniformLocation(program, "u_resolution");
		tex_coord_attribute_location = gl.getAttribLocation(program, "a_tex_coord");
		time_uniform_location = gl.getUniformLocation(program, "u_time");
		mask_pos_uniform_location = gl.getUniformLocation(program, "u_mask_pos");

		position_buffer = gl.createBuffer();

		gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			0, 0,
			gl.canvas.width, 0,
			0, gl.canvas.height,
			0, gl.canvas.height,
			gl.canvas.width, 0,
			gl.canvas.width, gl.canvas.height]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(position_attribute_location);
		//gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);
		gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);

		let tex_coord_buffer = gl.createBuffer();

		gl.bindBuffer(gl.ARRAY_BUFFER, tex_coord_buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			0.0, 0.0,
			1.0, 0.0,
			0.0, 1.0,
			0.0, 1.0,
			1.0, 0.0,
			1.0, 1.0]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(tex_coord_attribute_location);
		gl.vertexAttribPointer(tex_coord_attribute_location, 2, gl.FLOAT, false, 0, 0);

		gl.uniform2f(resolution_uniform_location, gl.canvas.width, gl.canvas.height);
		gl.uniform1f(time_uniform_location, performance.now() / 1000);
		gl.uniform1f(mask_pos_uniform_location, -0.1);
	}

	this.makeTexture = function(object)
	{
		let image = object instanceof HTMLImageElement ? object : object.image;

		image.texture = gl.createTexture();

		gl.activeTexture(gl.TEXTURE0 + image.texture_id);
		gl.bindTexture(gl.TEXTURE_2D, image.texture);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, object);

		gl.uniform1i(gl.getUniformLocation(program, "u_image" + image.texture_id), image.texture_id);
	}

	/*function setClearTexture()
	{

	}*/

	this.changeImage = function(url, cur_texture)
	{
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, cur_texture);

		gl.uniform1f(mask_pos_uniform_location, 1.1);
	}

	this.changeMaskPosition = function(target, values)
	{
		gl.uniform1f(mask_pos_uniform_location, values.y);
	}

	this.render = function()
	{
		//gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

		//gl.activeTexture(gl.TEXTURE0);
		//gl.bindTexture(gl.TEXTURE_2D, texture);

		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.uniform1f(time_uniform_location, performance.now() / 1000);

		/*gl.enableVertexAttribArray(position_attribute_location);
		//gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);
		gl.vertexAttribPointer(position_attribute_location, 2, gl.FLOAT, false, 0, 0);*/

		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

}