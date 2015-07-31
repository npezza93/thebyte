class PostsController < ApplicationController
	before_action :set_post, only: [:show, :edit, :update, :destroy]
	before_action :set_user
	before_filter :admin_check, :only => [:new, :edit, :destroy, :create, :update]

	# GET /posts
	# GET /posts.json
	def index
		@posts = Post.order('created_at DESC').where(status:true).page(params[:page]).per(10)
		respond_to do |format|
			format.html
		end
	end

	# GET /posts/1
	# GET /posts/1.json
	def show
		respond_to do |format|
			format.js
			format.html
		end
	end

	# GET /posts/new
	def new
		@post = Post.new
		@hash = AmazonSignature::data_hash
	end

	# GET /posts/1/edit
	def edit
		@hash = AmazonSignature::data_hash		
	end

	# POST /posts
	# POST /posts.json
	def create
		@post = Post.new(post_params)
		@post.author = @user.username

		respond_to do |format|
			if @post.save
				format.html { redirect_to root_url + "#!/" + @post.id.to_s, notice: 'Post was successfully created.' }
				format.js {}
				format.json { render action: 'show', status: :created, location: @post }
			else
				format.html { render action: 'new' }
				format.json { render json: @post.errors, status: :unprocessable_entity }
			end
		end
	end

	# PATCH/PUT /posts/1
	# PATCH/PUT /posts/1.json
	def update
		respond_to do |format|
			if @post.update(post_params)
				format.html { redirect_to root_url + "#!/" + @post.id.to_s, notice: 'Post was successfully updated.' }
				format.json { head :no_content }
				format.js 
			else
				format.html { render action: 'edit' }
				format.json { render json: @post.errors, status: :unprocessable_entity }
			end
		end
	end

	# DELETE /posts/1
	# DELETE /posts/1.json
	def destroy
		@post.destroy
		respond_to do |format|
			format.html { redirect_to posts_url }
			format.json { head :no_content }
		end
	end

	private
		# Use callbacks to share common setup or constraints between actions.
		def set_post
			@post = Post.find_by_slug(params[:id])
		end

		# Never trust parameters from the scary internet, only allow the white list through.
		def post_params
			params.require(:post).permit(:title, :author, :image, :content, :status)
		end

		def admin_check
			if @user == nil
				redirect_to posts_url, notice: "You are not authorized to access this page."
			elsif not @user.administrator
				redirect_to posts_url, notice: "You are not authorized to access this page."
			end
		end

		def set_user
			begin
				@user = User.find(session[:user_id])
			rescue
				@user = nil
			end
		end
end
