class MediaManagerController < ApplicationController
	def retrieve
		@images = S3_BUCKET.objects.with_prefix('post_uploads').collect(&:key).map{ |el| 'https://while_true.s3.amazonaws.com/' + el }


		respond_to do |format|
		  format.json { render :json => @images }
		end
	end

	def delete
		src = (params[:src]).split("/")
		src.shift
		src.shift
		src.shift
		src = src.join("/")
		to_delete = [S3_BUCKET.objects[src]]
		puts S3_BUCKET.objects.delete(to_delete)

		render nothing: true
	end

	def file_upload
		obj = S3_BUCKET.objects[params[:file].original_filename]

		obj.write(
			file: params[:file],
			acl: :public_read
		)

		response = { link: obj.public_url.to_s }
		puts response
		respond_to do |format|
		  format.json { render json: response }
		end
	end
end
