class UsersController < ApplicationController
  before_action :set_user, only: [:show, :edit, :update, :destroy]
  before_filter :admin_check, :only => [:index, :destroy]
  before_filter :user_check, :only => [:show, :edit, :update]

  # GET /users
  # GET /users.json
  def index
    @users = User.all.order('lower(username) ASC').paginate(page: params[:page], per_page: 10)
  end

  # GET /users/1
  # GET /users/1.json
  def show
  end

  # GET /users/new
  def new
    @user = User.new
  end

  # GET /users/1/edit
  def edit
  end

  # POST /users
  # POST /users.json
  def create
    @user = User.new(reg_user_params_create)
    
    respond_to do |format|
      if @user.save
        @sess_vars = User.find_by(username: @user.username)
          session[:user_id] = @sess_vars.id 
          session[:user_name] = @user.username
        @flag = true
        format.html { redirect_to posts_path, notice: 'Your account has been created.' }
        format.json { render action: 'show', status: :created, location: @user }
        format.js { @status = "Welcome to While True, " + @user.username + "!"}
      else
        @flag =false
        format.js {}
        format.html { render action: 'new' }
        format.json { render json: @user.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /users/1
  # PATCH/PUT /users/1.json
  def update
    # if params[:image[:@tempfile]] == nil
    #   redirect_to posts_path, notice: 'file'
    # else 
    #   redirect_to posts_path, notice: 'no file'
    # end
    if @user.administrator
      respond_to do |format|
        if @user.update(user_params)
          format.html { redirect_to posts_path, notice: 'User was successfully updated.' }
          format.json { head :no_content }
          format.js {}
        else
          format.html { render action: 'edit' }
          format.json { render json: @user.errors, status: :unprocessable_entity }
        end
      end
    else 
      respond_to do |format|
        if @user.update(reg_user_params)
          format.html { redirect_to posts_path, notice: 'User was successfully updated.' }
          format.json { head :no_content }
          format.js {}
        else
          format.html { render action: 'edit' }
          format.json { render json: @user.errors, status: :unprocessable_entity }
        end
      end
    end
  end

  # DELETE /users/1
  # DELETE /users/1.json
  def destroy
    @user.destroy
    respond_to do |format|
      format.html { redirect_to users_url }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_user
      @user = User.find(params[:id])
    end

    # Never trust parameters from the scary internet, only allow the white list through.
    def user_params
      params.require(:user).permit(:username, :password, :password_confirmation, :administrator, :email, :image)
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