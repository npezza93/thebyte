class SessionsController < ApplicationController
  def new
  end

  def create
  	user = User.find_by(username: params[:username])
  	respond_to do |format|
	  	if user and user.authenticate(params[:password])
	  		session[:user_id] = user.id 
	      	session[:user_name] = user.username
	      	@flag = true

       		format.js { @status = "You successfully logged in."}
	  	else
	  		@flag = false
       		format.js { @status = "Invalid username/password combiniation" }
	  	end
	  end
  end

  def destroy
  	session[:user_id] = nil
  	respond_to do |format|
  		format.js
  	end
  end
end
