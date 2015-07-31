class UsersController < ApplicationController
	before_action :set_user, only: [:edit, :update, :destroy]
	before_filter :admin_check, :only => [:index, :destroy]
	before_filter :user_check, :only => [:edit, :update]

	# GET /users
	# GET /users.json
	def index
		@session_user = User.find(session[:user_id])
		@users = User.where.not(id: @session_user.id).order('lower(username) ASC')
	end

	# GET /users/1/edit
	def edit
		@session_user = User.find(session[:user_id])
	end

	# POST /users
	# POST /users.json
	def create
		@user = User.new(reg_user_params_create)

		respond_to do |format|
			if @user.save
				session[:user_id] = @user.id
				session[:user_name] = @user.username
				flash[:notice] =  "Welcome to While True, " + @user.username + "!"

				 format.js { render :js => "window.location.href='/'"}
			else
				format.js {}
			end
		end
	end

	# PATCH/PUT /users/1
	# PATCH/PUT /users/1.json
	def update
		session_user = User.find(session[:user_id])
		respond_to do |format|
			if @user.administrator and @user.update(admin_params)
				format.html { redirect_to posts_path, notice: 'User was successfully updated.' }
				if session_user != @user
					format.js { @note = "#{@user.username} is no longer an administrator!" }
				else
					format.js { render :js => "window.location = '/posts'" }
				end	
			elsif session_user != @user and @user.update(admin_params)
				format.js { @note = "#{@user.username} is now an administrator!" }
			elsif not @user.administrator and @user.update(reg_user_params)
				flash[:notice] = "Password successfully changed!"
				format.html { redirect_to posts_path, notice: 'User was successfully updated.' }
				format.js { render js: "window.location = '/posts'" }
			else
				format.html { render action: 'edit' }
				format.js 
			end
		end
	end

	# DELETE /users/1
	# DELETE /users/1.json
	def destroy
		@user.destroy
		respond_to do |format|
			format.html { redirect_to users_url }
		end
	end

	private
		# Use callbacks to share common setup or constraints between actions.
		def set_user
			@user = User.find(params[:id])
		end

		# Never trust parameters from the scary internet, only allow the white list through.
		def admin_params
			params.require(:user).permit(:password, :password_confirmation, :administrator, :image)
		end

		# since my trust in humanity is exceedingly low
		def reg_user_params
			params.require(:user).permit(:password, :password_confirmation, :image)
		end

		def reg_user_params_create
			params.require(:user).permit(:username, :password, :password_confirmation, :email, :image)
		end

		def admin_check
			if User.find_by_id(session[:user_id]) == nil
					redirect_to posts_url, notice: "You are not authorized to view this page."
			elsif User.find_by_id(session[:user_id]).administrator == false
					redirect_to posts_url, notice: "You are not authorized to view this page."
			end
		end

		def user_check
			@user = User.find(params[:id])
			if User.find_by_id(session[:user_id]) == nil
					redirect_to posts_url, notice: "You are not authorized to view this page."
			else
				if User.find_by_id(session[:user_id]).administrator == false
					if User.find_by_id(session[:user_id]) != @user
						redirect_to posts_url, notice: "You are not authorized to view this page."
					end
				end
			end
		end
end
