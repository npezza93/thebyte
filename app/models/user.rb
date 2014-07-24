class User < ActiveRecord::Base
	validates :username, presence: true, uniqueness: true
	validates :email, presence: true
  	has_secure_password
  	validates :password, length: { minimum: 6 }, :on => :create
  	mount_uploader :image, AvatarUploader
end