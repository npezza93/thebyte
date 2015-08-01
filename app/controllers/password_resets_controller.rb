class PasswordResetsController < ApplicationController
	def new
	end

	def create
		user = User.find_by_email(params[:email])
		user.send_password_reset if user
		respond_to do |format|
				format.html { redirect_to root_url, notice: "Email sent with password reset instructions." }
				format.js {}
		end
	end

	def edit
		@user = User.find_by_password_reset_token!(params[:id])
	end

	def update
		@user = User.find_by_password_reset_token!(params[:id])
		if @user.password_reset_sent_at < 2.hours.ago
			redirect_to root_url, notice: "Password reset has expired."
		else
			respond_to do |format|
				if @user.update(user_params)
					format.html { redirect_to root_url, notice: 'Password successfully reset. Please log in.' }
					format.json { head :no_content }
					format.js {}
				else
					format.html { render action: 'edit' }
					format.json { render json: @user.errors, status: :unprocessable_entity }
				end
			end
		end
	end

	private
		# Never trust parameters from the scary internet, only allow the white list through.
		def user_params
			params.require(:user).permit(:password, :password_confirmation)
		end

end
