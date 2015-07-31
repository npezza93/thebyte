class SessionsController < ApplicationController
	def create
		@user = User.find_by(username: params[:username])
		respond_to do |format|
			if @user and @user.authenticate(params[:password])
				session[:user_id] = @user.id 
				flash[:notice] =  "Welcome back, " + @user.username + "!" 

				 format.js { render :js => "window.location.href='/'"}
			else
				format.js { @status = "Invalid username/password combiniation" }
			end
		end
	end

	def destroy
		session[:user_id] = nil
		respond_to do |format|
			flash[:notice] = "You have been logged out!"
			format.html { redirect_to root_url}
		end
	end
end
